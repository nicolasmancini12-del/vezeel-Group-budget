import * as XLSX from 'xlsx';
import { BudgetEntry, CategoryType, CompanyDetail, BudgetVersion, CategoryAssignment } from '../types';
import { MONTHS } from '../constants';

export const excelService = {
  exportBudget: (entries: BudgetEntry[], companyName: string) => {
    const relevantEntries = companyName.includes("Consolidado") 
        ? entries 
        : entries.filter(e => e.company.trim().toLowerCase() === companyName.trim().toLowerCase());

    const grouped = new Map<string, BudgetEntry[]>();

    relevantEntries.forEach(e => {
      const key = `${e.category}|${e.subCategory.trim()}|${(e.client || 'General').trim()}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(e);
    });

    const rows: any[] = [];

    grouped.forEach((groupEntries, key) => {
      const [cat, sub, cli] = key.split('|');
      const row: any = {
        'Categoría': cat,
        'Concepto': sub,
        'Cliente': cli
      };

      MONTHS.forEach((m, idx) => {
        const entry = groupEntries.find(e => e.month === idx + 1);
        const units = entry ? entry.planUnits : 0;
        const total = entry ? entry.planValue : 0;
        
        // Usar el valor maestro guardado en lugar de calcularlo
        const masterVal = entry 
            ? (cat === 'Ingresos' ? entry.salePrice : (cat === 'Costos Directos' ? entry.unitDirectCost : total)) 
            : 0;

        row[`${m} Q`] = units;
        row[`${m} PUnit Maestro`] = masterVal || 0;
        row[`${m} Total`] = total;
      });

      rows.push(row);
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    const cleanName = companyName.replace(/[\[\]\*\?\/\\\:]/g, "").substring(0, 30);
    XLSX.utils.book_append_sheet(wb, ws, cleanName);

    const fileName = `Presupuesto_Detalle_2026_${companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xlsx`;
    XLSX.writeFile(wb, fileName);
  },

  exportConfigMatrix: (assignments: CategoryAssignment[]) => {
      const rows = assignments.map(a => ({
          'Empresa': a.companyName.trim(),
          'Categoría': a.categoryType,
          'Concepto': a.categoryName.trim(),
          'Cliente': (a.clientName || 'General').trim()
      }));
      
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Configuracion_Conceptos");
      XLSX.writeFile(wb, "Matriz_Configuracion_Vezeel.xlsx");
  },

  importConfigMatrix: async (file: File): Promise<CategoryAssignment[]> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
              try {
                  const data = e.target?.result;
                  const workbook = XLSX.read(data, { type: 'binary' });
                  const sheet = workbook.Sheets[workbook.SheetNames[0]];
                  const json = XLSX.utils.sheet_to_json(sheet);
                  
                  const assignments: CategoryAssignment[] = json.map((row: any) => ({
                      companyName: (row['Empresa'] || '').toString().trim(),
                      categoryType: (row['Categoría'] || '').toString().trim(),
                      categoryName: (row['Concepto'] || '').toString().trim(),
                      clientName: (row['Cliente'] === 'General' || !row['Cliente']) ? '' : row['Cliente'].toString().trim()
                  }));
                  resolve(assignments);
              } catch (err) { reject(err); }
          };
          reader.readAsBinaryString(file);
      });
  },

  exportSummary: (entries: BudgetEntry[], companies: CompanyDetail[], version: BudgetVersion, exchangeRates: any[], currentView: string) => {
    const wb = XLSX.utils.book_new();
    const isConsolidated = currentView === 'CONSOLIDATED_VIEW';
    
    const sheetData: any[] = [
        ["REPORTE EJECUTIVO DE PRESUPUESTO - VEZEEL GROUP"],
        [`VERSIÓN: ${version.name}`],
        [`EMPRESA/VISTA: ${isConsolidated ? 'GRUPO VEZEEL (Consolidado)' : currentView}`],
        [`FECHA DE EXPORTACIÓN: ${new Date().toLocaleDateString()}`],
        [], 
        ["CONCEPTO / MES (USD)", ...MONTHS, "TOTAL ANUAL"]
    ];

    const targetCompanies = isConsolidated ? companies : companies.filter(c => c.name.trim().toLowerCase() === currentView.trim().toLowerCase());
    const grandTotals = Array(13).fill(0);

    targetCompanies.forEach(company => {
        const rows = {
            'Ingresos': Array(13).fill(0),
            'Costos Directos': Array(13).fill(0),
            'Costos Indirectos': Array(13).fill(0),
            'Resultado Neto': Array(13).fill(0)
        };

        const companyEntries = entries.filter(e => e.company.trim().toLowerCase() === company.name.trim().toLowerCase() && e.versionId === version.id);

        companyEntries.forEach(entry => {
            const mIdx = entry.month - 1;
            let rate = 1;
            if (company.currency !== 'USD') {
                const rateObj = exchangeRates.find((r: any) => r.company.trim().toLowerCase() === company.name.trim().toLowerCase() && r.month === entry.month && r.versionId === version.id);
                rate = rateObj?.planRate || 1;
            }
            const valUSD = entry.planValue / rate;

            if (entry.category === 'Ingresos') rows['Ingresos'][mIdx] += valUSD;
            else if (entry.category === 'Costos Directos') rows['Costos Directos'][mIdx] += valUSD;
            else if (entry.category === 'Costos Indirectos') rows['Costos Indirectos'][mIdx] += valUSD;
        });

        for (let i = 0; i < 12; i++) {
            rows['Resultado Neto'][i] = rows['Ingresos'][i] - rows['Costos Directos'][i] - rows['Costos Indirectos'][i];
            rows['Ingresos'][12] += rows['Ingresos'][i];
            rows['Costos Directos'][12] += rows['Costos Directos'][i];
            rows['Costos Indirectos'][12] += rows['Costos Indirectos'][i];
            rows['Resultado Neto'][12] += rows['Resultado Neto'][i];

            if (isConsolidated) {
                grandTotals[i] += rows['Resultado Neto'][i];
                grandTotals[12] += rows['Resultado Neto'][i];
            }
        }

        sheetData.push([`--- ${company.name} ---`]);
        sheetData.push(["Ingresos", ...rows['Ingresos'].map(v => Number(v.toFixed(2)))]);
        sheetData.push(["Costos Directos", ...rows['Costos Directos'].map(v => Number(v.toFixed(2)))]);
        sheetData.push(["Costos Indirectos", ...rows['Costos Indirectos'].map(v => Number(v.toFixed(2)))]);
        sheetData.push(["RESULTADO NETO", ...rows['Resultado Neto'].map(v => Number(v.toFixed(2)))]);
        sheetData.push([]); 
    });

    if (isConsolidated && targetCompanies.length > 1) {
        sheetData.push(["*** TOTAL GRUPO VEZEEL (USD) ***"]);
        sheetData.push(["Resultado Neto Consolidado", ...grandTotals.map(v => Number(v.toFixed(2)))]);
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, "Resumen Mensual");
    const cleanName = currentView.replace(/[\[\]\*\?\/\\\:]/g, "").substring(0, 20);
    const fileName = `Resumen_Ejecutivo_${cleanName}_2026.xlsx`;
    XLSX.writeFile(wb, fileName);
  },

  importBudget: async (file: File, companyName: string, versionId: string): Promise<BudgetEntry[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(worksheet);

          const newEntries: BudgetEntry[] = [];
          json.forEach((row: any) => {
            const category = (row['Categoría'] || '').toString().trim() as CategoryType;
            const subCategory = (row['Concepto'] || '').toString().trim() as string;
            const client = (row['Cliente'] === 'General' || !row['Cliente']) ? '' : row['Cliente'].toString().trim();
            if (!category || !subCategory) return;

            MONTHS.forEach((m, idx) => {
               const q = Number(row[`${m} Q`] || 0);
               // Soportar tanto PUnit como PUnit Maestro
               const p = Number(row[`${m} PUnit Maestro`] || row[`${m} PUnit`] || 0);
               const tot = Number(row[`${m} Total`] || 0);
               
               // Si viene Q y P, calculamos el total, sino usamos el total del excel
               const finalTotal = (q !== 0 && p !== 0) ? (q * p) : tot;

               newEntries.push({
                 id: `imp-${Math.random()}`,
                 month: idx + 1,
                 year: 2026,
                 company: companyName.trim(),
                 category,
                 subCategory,
                 client,
                 planUnits: q,
                 planValue: finalTotal,
                 realUnits: 0,
                 realValue: 0,
                 versionId,
                 salePrice: category === 'Ingresos' ? p : 0,
                 unitDirectCost: category === 'Costos Directos' ? p : 0
               });
            });
          });
          resolve(newEntries);
        } catch (error) { reject(error); }
      };
      reader.readAsBinaryString(file);
    });
  }
};