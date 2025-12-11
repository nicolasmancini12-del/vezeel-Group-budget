import React, { useState, useRef } from 'react';
import { BudgetEntry, CategoryType, AppConfig, ExchangeRate } from '../types';
import { MONTHS, generateId, CONSOLIDATED_ID } from '../constants';
import { Download, Upload, Calculator } from 'lucide-react'; // Necesita lucide-react en package.json
import { excelService } from '../services/excelService';

interface BudgetGridProps {
  entries: BudgetEntry[];
  exchangeRates: ExchangeRate[];
  companyName: string;
  versionId: string;
  config: AppConfig;
  onUpdateEntry: (entry: BudgetEntry) => void;
  onUpdateRate: (rate: ExchangeRate) => void;
  // Callback para cuando se importa excel
  onBulkUpdate?: (entries: BudgetEntry[]) => void;
}

const BudgetGrid: React.FC<BudgetGridProps> = ({ 
    entries, 
    exchangeRates, 
    companyName, 
    versionId, 
    config, 
    onUpdateEntry, 
    onUpdateRate,
    onBulkUpdate 
}) => {
  const [dataMode, setDataMode] = useState<'plan' | 'real'>('plan');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isConsolidated = companyName === CONSOLIDATED_ID;
  const companyConfig = config.companies.find(c => c.name === companyName);
  const currency = companyConfig?.currency || 'USD';

  // --- Excel Handlers ---
  const handleExport = () => {
    excelService.exportBudget(entries, companyName);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && onBulkUpdate) {
        try {
            const importedEntries = await excelService.importBudget(e.target.files[0], companyName, versionId);
            if (confirm(`Se encontraron ${importedEntries.length} registros. ¿Desea importarlos y sobrescribir?`)) {
                onBulkUpdate(importedEntries);
            }
        } catch (error) {
            alert('Error al leer el archivo Excel');
        }
    }
  };

  // --- Grid Logic ---
  const getEntry = (cat: CategoryType, sub: string, monthIdx: number): BudgetEntry => {
    if (isConsolidated) {
         // Return readonly dummy
         return {
            id: `cons-${monthIdx}`, month: monthIdx + 1, year: 2026, company: CONSOLIDATED_ID, category: cat, subCategory: sub,
            planValue: 0, planUnits: 0, realValue: 0, realUnits: 0, versionId
        };
    }
    const existing = entries.find(e => e.company === companyName && e.versionId === versionId && e.month === monthIdx + 1 && e.category === cat && e.subCategory === sub);
    if (existing) return existing;
    return {
      id: generateId(), month: monthIdx + 1, year: 2026, company: companyName, category: cat, subCategory: sub,
      planValue: 0, planUnits: 0, realValue: 0, realUnits: 0, versionId
    };
  };

  const handlePxQChange = (cat: CategoryType, sub: string, monthIdx: number, type: 'Q' | 'P', valueStr: string) => {
    if (isConsolidated) return;
    
    const entry = getEntry(cat, sub, monthIdx);
    const val = parseFloat(valueStr) || 0;
    
    let newEntry = { ...entry };

    if (dataMode === 'plan') {
        // Logic: Total = Units * Price
        // We store Total (Value) and Units. Price is derived.
        // If user changes Units (Q): Update Units, Recalculate Total (keeping Price constant).
        // If user changes Price (P): Recalculate Total (keeping Units constant).

        const currentQ = entry.planUnits;
        const currentTotal = entry.planValue;
        const currentP = currentQ !== 0 ? currentTotal / currentQ : 0;

        if (type === 'Q') {
            newEntry.planUnits = val;
            newEntry.planValue = val * currentP;
        } else {
            // Changing Price
            newEntry.planValue = currentQ * val;
            // Units stay same
        }
    } else {
        // Real Mode logic (same)
        const currentQ = entry.realUnits;
        const currentTotal = entry.realValue;
        const currentP = currentQ !== 0 ? currentTotal / currentQ : 0;

        if (type === 'Q') {
            newEntry.realUnits = val;
            newEntry.realValue = val * currentP;
        } else {
            newEntry.realValue = currentQ * val;
        }
    }
    
    onUpdateEntry(newEntry);
  };

  // Helper to get Price for display
  const getPrice = (entry: BudgetEntry, mode: 'plan' | 'real') => {
      const q = mode === 'plan' ? entry.planUnits : entry.realUnits;
      const t = mode === 'plan' ? entry.planValue : entry.realValue;
      return q !== 0 ? t / q : 0;
  }

  const renderGridRow = (cat: CategoryType, sub: string) => {
    const cells = MONTHS.map((_, idx) => {
        const entry = getEntry(cat, sub, idx);
        
        const Q = dataMode === 'plan' ? entry.planUnits : entry.realUnits;
        const Total = dataMode === 'plan' ? entry.planValue : entry.realValue;
        const P = getPrice(entry, dataMode);

        return (
            <td key={idx} className="border-r border-gray-200 p-1 min-w-[120px] bg-white hover:bg-slate-50 transition-colors">
                <div className="flex flex-col gap-1">
                    {/* Fila superior: Cantidad x Precio */}
                    <div className="flex gap-1">
                        <div className="relative flex-1">
                            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 font-bold">Q</span>
                            <input 
                                type="number"
                                disabled={isConsolidated}
                                className="w-full text-right text-xs border border-gray-100 rounded bg-slate-50 focus:bg-white focus:border-blue-400 outline-none px-1 py-1 pl-3"
                                value={Q || ''}
                                placeholder="0"
                                onChange={(e) => handlePxQChange(cat, sub, idx, 'Q', e.target.value)}
                            />
                        </div>
                        <div className="relative flex-1">
                            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 font-bold">$</span>
                            <input 
                                type="number"
                                disabled={isConsolidated}
                                className="w-full text-right text-xs border border-gray-100 rounded bg-slate-50 focus:bg-white focus:border-blue-400 outline-none px-1 py-1 pl-3"
                                value={P || ''}
                                placeholder="0"
                                onChange={(e) => handlePxQChange(cat, sub, idx, 'P', e.target.value)}
                            />
                        </div>
                    </div>
                    {/* Fila inferior: Total Calculado */}
                    <div className="text-right px-1">
                        <span className={`text-xs font-bold ${Total > 0 ? 'text-slate-700' : 'text-gray-300'}`}>
                            {Total.toLocaleString('es-AR', { style: 'currency', currency: currency })}
                        </span>
                    </div>
                </div>
            </td>
        );
    });

    return (
        <tr key={sub} className="border-b border-gray-100 hover:bg-gray-50">
            <td className="sticky left-0 bg-white z-10 border-r border-gray-200 p-2 shadow-sm">
                 <div className="w-[200px] truncate text-sm font-medium text-slate-700" title={sub}>{sub}</div>
            </td>
            {cells}
        </tr>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-slate-50 flex justify-between items-center">
            <div className="flex gap-2">
                <button onClick={() => setDataMode('plan')} className={`px-3 py-1.5 text-sm font-medium rounded ${dataMode === 'plan' ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>Plan</button>
                <button onClick={() => setDataMode('real')} className={`px-3 py-1.5 text-sm font-medium rounded ${dataMode === 'real' ? 'bg-purple-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>Real</button>
            </div>
            
            {!isConsolidated && (
                <div className="flex gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx,.xls" />
                    <button onClick={handleImportClick} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">
                        <Upload size={16} /> Importar Excel
                    </button>
                    <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 shadow-sm">
                        <Download size={16} /> Exportar
                    </button>
                </div>
            )}
        </div>

        {/* Header explanation */}
        <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 flex gap-6 text-xs text-blue-800">
            <div className="flex items-center gap-2">
                <span className="font-bold bg-white border border-blue-200 px-1 rounded">Q</span> Cantidad
            </div>
            <div className="flex items-center gap-2">
                <span className="font-bold bg-white border-blue-200 px-1 rounded">$</span> Precio Unitario
            </div>
            <div className="flex items-center gap-2">
                <span className="font-bold">Total</span> (Automático)
            </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
                    <tr>
                        <th className="sticky left-0 top-0 z-30 bg-slate-100 p-3 text-left w-[200px] text-xs font-bold text-gray-500 uppercase border-b border-r border-gray-200">Concepto</th>
                        {MONTHS.map(m => (
                            <th key={m} className="p-2 text-center min-w-[120px] text-xs font-bold text-gray-500 uppercase border-b border-gray-200 border-r">{m}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {(['Ingresos', 'Costos Directos', 'Costos Indirectos'] as CategoryType[]).map(cat => (
                         <React.Fragment key={cat}>
                            <tr className="bg-gray-100"><td colSpan={13} className="px-4 py-2 text-xs font-bold text-gray-600 uppercase border-b">{cat}</td></tr>
                            {config.categories[cat].map(sub => renderGridRow(cat, sub))}
                         </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );
};

export default BudgetGrid;
