import * as XLSX from 'xlsx';
import { BudgetEntry, CategoryType, CompanyDetail } from '../types';
import { MONTHS } from '../constants';

// Estructura de filas para excel detallado
interface ExcelRow {
  Categoría: string;
  Concepto: string;
  [key: string]: string | number;
}

// Estructura para el resumen ejecutivo
interface SummaryRow {
  Empresa: string;
  'Total Ingresos': number;
  'Total Costos Directos': number;
  'Total Costos Indirectos': number;
  'Resultado Neto': number;
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

  exportSummary: (entries: BudgetEntry[], companies: CompanyDetail[], versionId: string, exchangeRates: any[]) => {
    const rows: SummaryRow[] = [];
    let grandTotal = { inc: 0, cd: 0, ci: 0, net: 0 };

    companies.forEach(company => {
        let income = 0;
        let costsDirect = 0;
        let costsIndirect = 0;

        const companyEntries = entries.filter(e => e.company === company.name && e.versionId === versionId);

        companyEntries.forEach(entry => {
            // Obtener tasa para convertir a USD si es necesario
            let rate = 1;
            if (company.currency !== 'USD') {
                const rateObj = exchangeRates.find(r => r.company === company.name && r.month === entry.month && r.versionId === versionId);
                rate = rateObj?.planRate || 1;
            }

            const valUSD = entry.planValue / rate;

            if (entry.category === 'Ingresos') income += valUSD;
            else if (entry.category === 'Costos Directos') costsDirect += valUSD;
            else if (entry.category === 'Costos Indirectos') costsIndirect += valUSD;
        });

        const net = income - costsDirect - costsIndirect;

        rows.push({
            'Empresa': company.name,
            'Total Ingresos': Number(income.toFixed(2)),
            'Total Costos Directos': Number(costsDirect.toFixed(2)),
            'Total Costos Indirectos': Number(costsIndirect.toFixed(2)),
            'Resultado Neto': Number(net.toFixed(2))
        });

        grandTotal.inc += income;
        grandTotal.cd += costsDirect;
        grandTotal.ci += costsIndirect;
        grandTotal.net += net;
    });

    // Agregar Fila de Totales del Grupo
    rows.push({
        'Empresa': 'TOTAL GRUPO VEZEEL',
        'Total Ingresos': Number(grandTotal.inc.toFixed(2)),
        'Total Costos Directos': Number(grandTotal.cd.toFixed(2)),
        'Total Costos Indirectos': Number(grandTotal.ci.toFixed(2)),
        'Resultado Neto': Number(grandTotal.net.toFixed(2))
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resumen Ejecutivo");

    const fileName = `Resumen_Ejecutivo_Vezeel_2026.xlsx`;
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