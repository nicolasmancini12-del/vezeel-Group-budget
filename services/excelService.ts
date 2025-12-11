import * as XLSX from 'xlsx';
import { BudgetEntry, CategoryType } from '../types';
import { MONTHS } from '../constants';

// Estructura de filas para excel
interface ExcelRow {
  Categoría: string;
  Concepto: string;
  [key: string]: string | number; // "Ene Q", "Ene $", "Ene Tot"...
}

export const excelService = {
  exportBudget: (entries: BudgetEntry[], companyName: string) => {
    // Filtrar solo de esta empresa
    const relevantEntries = entries.filter(e => e.company === companyName);

    // Agrupar por Concepto para crear filas
    // Mapa: "Categoria|Subcategoria" -> Entry[]
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

      // Llenar datos mensuales (Planificado)
      // Asumimos exportar Plan. Se podría hacer hoja aparte para Real.
      MONTHS.forEach((m, idx) => {
        const entry = groupEntries.find(e => e.month === idx + 1);
        const units = entry ? entry.planUnits : 0;
        const total = entry ? entry.planValue : 0;
        // Derivar Precio
        const price = units !== 0 ? total / units : 0;

        row[`${m} Q`] = units;
        row[`${m} PUnit`] = price;
        row[`${m} Total`] = total;
      });

      rows.push(row);
    });

    // Crear Workbook
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Presupuesto ${companyName}`);

    // Descargar
    XLSX.writeFile(wb, `Presupuesto_2026_${companyName}.xlsx`);
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

               // Prioridad: Si Excel tiene Total, usa Total. Si no, Q*P.
               const finalTotal = tot !== 0 ? tot : (q * p);

               newEntries.push({
                 id: `imp-${Math.random()}`, // ID temporal, el upsert lo manejará o generará nuevo UUID en DB si se omite
                 month: idx + 1,
                 year: 2026,
                 company: companyName,
                 category,
                 subCategory,
                 planUnits: q,
                 planValue: finalTotal,
                 realUnits: 0, // Excel import resets real? Or we should check logic. Assuming budget import.
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
