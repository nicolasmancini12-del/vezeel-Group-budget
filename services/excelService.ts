import * as XLSX from 'xlsx';
import { BudgetEntry, CategoryType, CompanyDetail, BudgetVersion } from '../types';
import { MONTHS } from '../constants';

// Estructura de filas para excel detallado
interface ExcelRow {
  Categoría: string;
  Concepto: string;
  [key: string]: string | number;
}

export const excelService = {
  exportBudget: (entries: BudgetEntry[], companyName: string) => {
    const relevantEntries = companyName.includes("Consolidado") 
        ? entries 
        : entries.filter(e => e.company === companyName);

    const grouped = new Map<string, BudgetEntry[]>();

    relevantEntries.forEach(e => {
      const key = `${e.category}|${e.subCategory}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(e);
    });

    const rows: ExcelRow[] = [];

    grouped.forEach((groupEntries, key) => {
      const [cat, sub] = key.split('|');
      const row: ExcelRow = {
        'Categoría': cat,
        'Concepto': sub
      };

      MONTHS.forEach((m, idx) => {
        const entry = groupEntries.find(e => e.month === idx + 1);
        const units = entry ? entry.planUnits : 0;
        const total = entry ? entry.planValue : 0;
        const price = units !== 0 ? total / units : 0;

        row[`${m} Q`] = units;
        row[`${m} PUnit`] = price;
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

  exportSummary: (entries: BudgetEntry[], companies: CompanyDetail[], version: BudgetVersion, exchangeRates: any[], currentView: string) => {
    const wb = XLSX.utils.book_new();
    const isConsolidated = currentView === 'CONSOLIDATED_VIEW';
    
    // Preparar datos para la hoja
    const sheetData: any[] = [
        ["REPORTE EJECUTIVO DE PRESUPUESTO - VEZEEL GROUP"],
        [`VERSIÓN: ${version.name}`],
        [`EMPRESA/VISTA: ${isConsolidated ? 'GRUPO VEZEEL (Consolidado)' : currentView}`],
        [`FECHA DE EXPORTACIÓN: ${new Date().toLocaleDateString()}`],
        [], // Línea en blanco
        ["CONCEPTO / MES (USD)", ...MONTHS, "TOTAL ANUAL"]
    ];

    const targetCompanies = isConsolidated ? companies : companies.filter(c => c.name === currentView);
    const grandTotals = Array(13).fill(0); // 12 meses + 1 total anual

    targetCompanies.forEach(company => {
        const rows = {
            'Ingresos': Array(13).fill(0),
            'Costos Directos': Array(13).fill(0),
            'Costos Indirectos': Array(13).fill(0),
            'Resultado Neto': Array(13).fill(0)
        };

        const companyEntries = entries.filter(e => e.company === company.name && e.versionId === version.id);

        companyEntries.forEach(entry => {
            const mIdx = entry.month - 1;
            let rate = 1;
            if (company.currency !== 'USD') {
                const rateObj = exchangeRates.find((r: any) => r.company === company.name && r.month === entry.month && r.versionId === version.id);
                rate = rateObj?.planRate || 1;
            }
            const valUSD = entry.planValue / rate;

            if (entry.category === 'Ingresos') rows['Ingresos'][mIdx] += valUSD;
            else if (entry.category === 'Costos Directos') rows['Costos Directos'][mIdx] += valUSD;
            else if (entry.category === 'Costos Indirectos') rows['Costos Indirectos'][mIdx] += valUSD;
        });

        // Calcular Resultado Neto Mensual y Totales Anuales
        for (let i = 0; i < 12; i++) {
            rows['Resultado Neto'][i] = rows['Ingresos'][i] - rows['Costos Directos'][i] - rows['Costos Indirectos'][i];
            
            // Sumar al total anual de la empresa
            rows['Ingresos'][12] += rows['Ingresos'][i];
            rows['Costos Directos'][12] += rows['Costos Directos'][i];
            rows['Costos Indirectos'][12] += rows['Costos Indirectos'][i];
            rows['Resultado Neto'][12] += rows['Resultado Neto'][i];

            // Sumar al total anual del GRUPO si es consolidado
            if (isConsolidated) {
                grandTotals[i] += rows['Resultado Neto'][i];
                grandTotals[12] += rows['Resultado Neto'][i];
            }
        }

        // Agregar bloques de datos al sheet
        sheetData.push([`--- ${company.name} ---`]);
        sheetData.push(["Ingresos", ...rows['Ingresos'].map(v => Number(v.toFixed(2)))]);
        sheetData.push(["Costos Directos", ...rows['Costos Directos'].map(v => Number(v.toFixed(2)))]);
        sheetData.push(["Costos Indirectos", ...rows['Costos Indirectos'].map(v => Number(v.toFixed(2)))]);
        sheetData.push(["RESULTADO NETO", ...rows['Resultado Neto'].map(v => Number(v.toFixed(2)))]);
        sheetData.push([]); // Espacio entre empresas
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
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);

          const newEntries: BudgetEntry[] = [];
          json.forEach((row: any) => {
            const category = row['Categoría'] as CategoryType;
            const subCategory = row['Concepto'] as string;
            if (!category || !subCategory) return;

            MONTHS.forEach((m, idx) => {
               const q = Number(row[`${m} Q`] || 0);
               const p = Number(row[`${m} PUnit`] || 0);
               const tot = Number(row[`${m} Total`] || 0);
               const finalTotal = tot !== 0 ? tot : (q * p);

               newEntries.push({
                 id: `imp-${Math.random()}`,
                 month: idx + 1,
                 year: 2026,
                 company: companyName,
                 category,
                 subCategory,
                 planUnits: q,
                 planValue: finalTotal,
                 realUnits: 0,
                 realValue: 0,
                 versionId
               });
            });
          });
          resolve(newEntries);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsBinaryString(file);
    });
  }
};