
import React, { useState, useRef, useMemo } from 'react';
import { BudgetEntry, CategoryType, AppConfig, ExchangeRate } from '../types';
import { MONTHS, generateId, CONSOLIDATED_ID } from '../constants';
import { Download, Upload, Zap, X } from 'lucide-react'; 
import { excelService } from '../services/excelService';

interface BudgetGridProps {
  entries: BudgetEntry[];
  exchangeRates: ExchangeRate[];
  companyName: string;
  versionId: string;
  config: AppConfig;
  onUpdateEntry: (entry: BudgetEntry) => void;
  onUpdateRate: (rate: ExchangeRate) => void;
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
  const currency = isConsolidated ? 'USD' : (companyConfig?.currency || 'USD');

  // --- Projection State ---
  const [projModal, setProjModal] = useState<{ isOpen: boolean; cat: CategoryType | null; sub: string | null } | null>(null);
  const [projTarget, setProjTarget] = useState<'Q' | 'P'>('Q');
  const [projMethod, setProjMethod] = useState<'replicate' | 'adjust'>('replicate');
  const [projValue, setProjValue] = useState('');

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
    const monthNum = monthIdx + 1;

    if (isConsolidated) {
        // --- LOGIC FOR CONSOLIDATED VIEW ---
        const relevantEntries = entries.filter(e => 
            e.versionId === versionId &&
            e.category === cat &&
            e.subCategory === sub &&
            e.month === monthNum
        );

        let totalPlanVal = 0;
        let totalPlanUnits = 0;
        let totalRealVal = 0;
        let totalRealUnits = 0;

        relevantEntries.forEach(entry => {
            const comp = config.companies.find(c => c.name === entry.company);
            const entryCurrency = comp?.currency || 'USD';

            let planRate = 1;
            let realRate = 1;

            if (entryCurrency !== 'USD') {
                const rateObj = exchangeRates.find(r => 
                    r.company === entry.company && 
                    r.versionId === versionId && 
                    r.month === monthNum
                );
                if (rateObj?.planRate && rateObj.planRate > 0) planRate = rateObj.planRate;
                if (rateObj?.realRate && rateObj.realRate > 0) realRate = rateObj.realRate;
            }

            totalPlanVal += (entry.planValue / planRate);
            totalRealVal += (entry.realValue / realRate);
            
            totalPlanUnits += entry.planUnits;
            totalRealUnits += entry.realUnits;
        });

        return {
            id: `cons-${monthIdx}-${cat}-${sub}`,
            month: monthNum,
            year: 2026,
            company: CONSOLIDATED_ID,
            category: cat,
            subCategory: sub,
            planValue: totalPlanVal,
            planUnits: totalPlanUnits,
            realValue: totalRealVal,
            realUnits: totalRealUnits,
            versionId
        };
    }

    // --- STANDARD VIEW ---
    const existing = entries.find(e => e.company === companyName && e.versionId === versionId && e.month === monthNum && e.category === cat && e.subCategory === sub);
    if (existing) return existing;
    return {
      id: generateId(), month: monthNum, year: 2026, company: companyName, category: cat, subCategory: sub,
      planValue: 0, planUnits: 0, realValue: 0, realUnits: 0, versionId
    };
  };

  const handlePxQChange = (cat: CategoryType, sub: string, monthIdx: number, type: 'Q' | 'P', valueStr: string) => {
    if (isConsolidated) return;
    
    // Validate Input: Allow numbers and decimals only
    if (valueStr !== '' && !/^\d*\.?\d*$/.test(valueStr)) return;

    const entry = getEntry(cat, sub, monthIdx);
    const val = valueStr === '' ? 0 : parseFloat(valueStr);
    
    let newEntry = { ...entry };

    if (dataMode === 'plan') {
        const currentQ = entry.planUnits;
        const currentTotal = entry.planValue;
        const currentP = currentQ !== 0 ? currentTotal / currentQ : 0;

        if (type === 'Q') {
            newEntry.planUnits = val;
            newEntry.planValue = val * currentP;
        } else {
            // Updating Price
            if (currentQ === 0 && val !== 0) {
                // Fix: If Quantity is 0, we force Q=1 so the Price can be set and Total calculated
                newEntry.planUnits = 1;
                newEntry.planValue = 1 * val;
            } else {
                newEntry.planValue = currentQ * val;
            }
        }
    } else {
        const currentQ = entry.realUnits;
        const currentTotal = entry.realValue;
        const currentP = currentQ !== 0 ? currentTotal / currentQ : 0;

        if (type === 'Q') {
            newEntry.realUnits = val;
            newEntry.realValue = val * currentP;
        } else {
            // Updating Price
            if (currentQ === 0 && val !== 0) {
                 // Fix: If Quantity is 0, we force Q=1 so the Price can be set and Total calculated
                newEntry.realUnits = 1;
                newEntry.realValue = 1 * val;
            } else {
                newEntry.realValue = currentQ * val;
            }
        }
    }
    
    onUpdateEntry(newEntry);
  };

  const getPrice = (entry: BudgetEntry, mode: 'plan' | 'real') => {
      const q = mode === 'plan' ? entry.planUnits : entry.realUnits;
      const t = mode === 'plan' ? entry.planValue : entry.realValue;
      return q !== 0 ? t / q : 0;
  }

  // --- Exchange Rate Logic ---
  const handleRateChange = (monthIdx: number, valueStr: string) => {
      if (isConsolidated) return;
      if (valueStr !== '' && !/^\d*\.?\d*$/.test(valueStr)) return;

      const val = valueStr === '' ? 0 : parseFloat(valueStr);
      const monthNum = monthIdx + 1;

      // Find existing or create new
      const existingRate = exchangeRates.find(r => 
          r.company === companyName && 
          r.versionId === versionId && 
          r.month === monthNum
      );

      const newRate: ExchangeRate = existingRate ? { ...existingRate } : {
          id: generateId(),
          company: companyName,
          month: monthNum,
          year: 2026,
          versionId,
          planRate: 1,
          realRate: 1
      };

      if (dataMode === 'plan') {
          newRate.planRate = val;
      } else {
          newRate.realRate = val;
      }

      onUpdateRate(newRate);
  };

  // --- Projection Logic ---
  const openProjection = (cat: CategoryType, sub: string) => {
      setProjModal({ isOpen: true, cat, sub });
      setProjTarget('Q');
      setProjMethod('replicate');
      setProjValue('');
  };

  const applyProjection = () => {
      if (!projModal || !onBulkUpdate) return;
      const { cat, sub } = projModal;
      if(!cat || !sub) return;

      const newEntries: BudgetEntry[] = [];
      const janEntry = getEntry(cat, sub, 0);
      const janQ = dataMode === 'plan' ? janEntry.planUnits : janEntry.realUnits;
      const janP = getPrice(janEntry, dataMode);
      
      const baseVal = projTarget === 'Q' ? janQ : janP;
      const rate = projMethod === 'adjust' ? (parseFloat(projValue) / 100) : 0;

      for (let i = 1; i < 12; i++) {
          const entry = getEntry(cat, sub, i);
          const currentP = getPrice(entry, dataMode);
          const currentQ = dataMode === 'plan' ? entry.planUnits : entry.realUnits;

          let newVal = baseVal;
          if (projMethod === 'adjust') {
              newVal = baseVal * Math.pow(1 + rate, i);
          }

          let updatedEntry = { ...entry };
          
          if (dataMode === 'plan') {
              if (projTarget === 'Q') {
                  updatedEntry.planUnits = newVal;
                  const effectiveP = currentP !== 0 ? currentP : janP;
                  updatedEntry.planValue = newVal * effectiveP;
              } else {
                  const effectiveQ = currentQ === 0 ? 1 : currentQ; // If projection implies price on 0 Q, set Q=1
                  if(currentQ === 0) updatedEntry.planUnits = 1;
                  updatedEntry.planValue = effectiveQ * newVal;
              }
          } else {
               if (projTarget === 'Q') {
                  updatedEntry.realUnits = newVal;
                  const effectiveP = currentP !== 0 ? currentP : janP;
                  updatedEntry.realValue = newVal * effectiveP;
              } else {
                  const effectiveQ = currentQ === 0 ? 1 : currentQ;
                  if(currentQ === 0) updatedEntry.realUnits = 1;
                  updatedEntry.realValue = effectiveQ * newVal;
              }
          }
          newEntries.push(updatedEntry);
      }
      
      onBulkUpdate(newEntries);
      setProjModal(null);
  };


  // --- Totals Calculation ---
  const monthlyTotals = useMemo(() => {
    return MONTHS.map((_, idx) => {
        let net = 0;
        (['Ingresos', 'Costos Directos', 'Costos Indirectos'] as CategoryType[]).forEach(cat => {
            config.categories[cat].forEach(sub => {
                if (!isConsolidated && config.assignments) {
                    const isAssigned = config.assignments.some(a => 
                        a.companyName === companyName && 
                        a.categoryType === cat && 
                        a.categoryName === sub
                    );
                    if (!isAssigned) return;
                }

                const entry = getEntry(cat, sub, idx);
                const val = dataMode === 'plan' ? entry.planValue : entry.realValue;
                
                if (cat === 'Ingresos') {
                    net += val;
                } else {
                    net -= val;
                }
            });
        });
        return net;
    });
  }, [entries, companyName, versionId, dataMode, config, exchangeRates]);


  const renderGridRow = (cat: CategoryType, sub: string) => {
    if (!isConsolidated && config.assignments) {
        const isAssigned = config.assignments.some(a => 
            a.companyName === companyName && 
            a.categoryType === cat && 
            a.categoryName === sub
        );
        if (!isAssigned) return null;
    }

    const cells = MONTHS.map((_, idx) => {
        const entry = getEntry(cat, sub, idx);
        
        const Q = dataMode === 'plan' ? entry.planUnits : entry.realUnits;
        const Total = dataMode === 'plan' ? entry.planValue : entry.realValue;
        const P = getPrice(entry, dataMode);

        return (
            <td key={idx} className={`border-r border-gray-200 p-1 min-w-[120px] ${isConsolidated ? 'bg-indigo-50/30' : 'bg-white hover:bg-slate-50'} transition-colors`}>
                <div className="flex flex-col gap-1">
                    <div className="flex gap-1">
                        <div className="relative flex-1">
                            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 font-bold">Q</span>
                            <input 
                                type="text"
                                inputMode="decimal"
                                disabled={isConsolidated}
                                className={`w-full text-right text-xs border border-gray-100 rounded outline-none px-1 py-1 pl-3 ${isConsolidated ? 'bg-transparent text-gray-600 font-medium' : 'bg-slate-50 focus:bg-white focus:border-blue-400'}`}
                                value={Q === 0 ? '' : Q}
                                placeholder="0"
                                onChange={(e) => handlePxQChange(cat, sub, idx, 'Q', e.target.value)}
                            />
                        </div>
                        <div className="relative flex-1">
                            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 font-bold">{isConsolidated ? 'US' : '$'}</span>
                            <input 
                                type="text"
                                inputMode="decimal"
                                disabled={isConsolidated}
                                className={`w-full text-right text-xs border border-gray-100 rounded outline-none px-1 py-1 pl-3 ${isConsolidated ? 'bg-transparent text-gray-600 font-medium' : 'bg-slate-50 focus:bg-white focus:border-blue-400'}`}
                                // FIX: Removed toFixed(2) to allow fluid typing of integers and decimals
                                value={P === 0 ? '' : P}
                                placeholder="0"
                                onChange={(e) => handlePxQChange(cat, sub, idx, 'P', e.target.value)}
                            />
                        </div>
                    </div>
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
        <tr key={sub} className="border-b border-gray-100 hover:bg-gray-50 group">
            <td className="sticky left-0 bg-white z-10 border-r border-gray-200 p-2 shadow-sm">
                 <div className="flex justify-between items-center">
                    <div className="w-[170px] truncate text-sm font-medium text-slate-700" title={sub}>{sub}</div>
                    {!isConsolidated && dataMode === 'plan' && (
                        <button 
                            onClick={() => openProjection(cat, sub)} 
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-amber-500 hover:bg-amber-50 p-1 rounded" 
                            title="Proyectar (Replicar o %)"
                        >
                            <Zap size={14} fill="currentColor" />
                        </button>
                    )}
                 </div>
            </td>
            {cells}
        </tr>
    );
  };

  const renderExchangeRateRow = () => {
      // Only show if not consolidated and currency is NOT USD
      if (isConsolidated || currency === 'USD') return null;

      return (
          <tr className="bg-blue-50/50 border-b border-blue-100 shadow-inner">
              <td className="sticky left-0 bg-blue-50 z-20 border-r border-blue-100 p-3 shadow-sm">
                  <div className="text-xs font-bold text-blue-800">TIPO DE CAMBIO ({currency}/USD)</div>
                  <div className="text-[10px] text-blue-600 mt-0.5">Editable Mensual</div>
              </td>
              {MONTHS.map((_, idx) => {
                  const monthNum = idx + 1;
                  const rateObj = exchangeRates.find(r => r.company === companyName && r.versionId === versionId && r.month === monthNum);
                  const val = dataMode === 'plan' ? rateObj?.planRate : rateObj?.realRate;
                  
                  return (
                      <td key={idx} className="p-2 border-r border-blue-100 min-w-[120px]">
                          <input 
                             type="text"
                             inputMode="decimal"
                             value={val === 0 || val === undefined ? '' : val}
                             onChange={(e) => handleRateChange(idx, e.target.value)}
                             placeholder="1.00"
                             className="w-full text-right text-xs bg-white border border-blue-200 rounded px-2 py-1.5 font-bold text-blue-700 focus:ring-2 focus:ring-blue-400 outline-none"
                          />
                      </td>
                  );
              })}
          </tr>
      )
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-slate-50 flex justify-between items-center">
            <div className="flex gap-2">
                <button onClick={() => setDataMode('plan')} className={`px-3 py-1.5 text-sm font-medium rounded ${dataMode === 'plan' ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>Plan</button>
                <button onClick={() => setDataMode('real')} className={`px-3 py-1.5 text-sm font-medium rounded ${dataMode === 'real' ? 'bg-purple-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>Real</button>
            </div>
            
            {/* Macro Preview Pills (Read Only) */}
             <div className="flex-1 px-8 overflow-x-auto">
                <div className="flex gap-4">
                    {config.companies.filter(c => c.currency !== 'USD').map(c => {
                         const rate = exchangeRates.find(r => r.company === c.name && r.versionId === versionId && r.month === 1);
                         const val = dataMode === 'plan' ? rate?.planRate : rate?.realRate;
                         return (
                             <div key={c.id} className="flex flex-col items-center bg-white px-3 py-1 rounded border border-gray-200 shadow-sm min-w-[100px]">
                                 <span className="text-[10px] text-gray-500 font-bold uppercase">{c.currency} / USD</span>
                                 <span className="text-xs font-bold text-slate-700">{val || '-'} (Ene)</span>
                             </div>
                         )
                    })}
                </div>
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
                <span className="font-bold bg-white border-blue-200 px-1 rounded">$</span> {isConsolidated ? 'Precio Promedio (USD)' : 'Precio Unitario'}
            </div>
            <div className="flex items-center gap-2">
                <span className="font-bold">Total</span> {isConsolidated ? '(Consolidado USD)' : '(Automático)'}
            </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto custom-scrollbar relative">
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
                    {/* Render Exchange Rate Row First */}
                    {renderExchangeRateRow()}

                    {(['Ingresos', 'Costos Directos', 'Costos Indirectos'] as CategoryType[]).map(cat => (
                         <React.Fragment key={cat}>
                            <tr className="bg-gray-100"><td colSpan={13} className="px-4 py-2 text-xs font-bold text-gray-600 uppercase border-b">{cat}</td></tr>
                            {config.categories[cat].map(sub => renderGridRow(cat, sub))}
                         </React.Fragment>
                    ))}
                </tbody>
                <tfoot className="sticky bottom-0 z-20 bg-slate-800 text-white shadow-lg border-t-2 border-slate-600">
                    <tr>
                        <td className="sticky left-0 bottom-0 z-30 bg-slate-800 p-3 text-left font-bold text-xs uppercase border-r border-slate-600">
                            RESULTADO NETO ({currency})
                        </td>
                        {monthlyTotals.map((val, idx) => (
                            <td key={idx} className="p-2 text-right min-w-[120px] border-r border-slate-600">
                                <span className={`text-sm font-bold ${val >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {val.toLocaleString('es-AR', { style: 'currency', currency: currency })}
                                </span>
                            </td>
                        ))}
                    </tr>
                </tfoot>
            </table>
        </div>

        {/* Projection Modal */}
        {projModal && projModal.isOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                    <div className="bg-amber-50 p-4 border-b border-amber-100 flex justify-between items-center">
                        <h3 className="font-bold text-amber-800 flex items-center gap-2">
                            <Zap size={18} fill="currentColor" /> Proyección Rápida
                        </h3>
                        <button onClick={() => setProjModal(null)} className="text-gray-400 hover:text-gray-600">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="text-sm text-gray-600">
                            Proyectando: <strong>{projModal.sub}</strong>
                            <div className="text-xs text-gray-400 mt-1">Se tomará el valor de <strong>Enero</strong> como base para el resto del año.</div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Variable a Proyectar</label>
                            <div className="flex gap-2">
                                <button onClick={() => setProjTarget('Q')} className={`flex-1 py-2 text-sm rounded border ${projTarget === 'Q' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'}`}>
                                    Cantidad (Q)
                                </button>
                                <button onClick={() => setProjTarget('P')} className={`flex-1 py-2 text-sm rounded border ${projTarget === 'P' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'}`}>
                                    Precio ($)
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Método</label>
                            <select 
                                value={projMethod} 
                                onChange={(e: any) => setProjMethod(e.target.value)}
                                className="w-full border rounded p-2 text-sm bg-white"
                            >
                                <option value="replicate">Replicar Enero (Mantener Fijo)</option>
                                <option value="adjust">Ajuste % Mensual (Acumulativo)</option>
                            </select>
                        </div>

                        {projMethod === 'adjust' && (
                             <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">% Crecimiento Mensual</label>
                                <input 
                                    type="number" 
                                    value={projValue} 
                                    onChange={(e) => setProjValue(e.target.value)}
                                    placeholder="Ej: 5 (para 5%)"
                                    className="w-full border rounded p-2 text-sm"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Ej: 5% hará que Febrero sea Enero + 5%, Marzo sea Febrero + 5%, etc.</p>
                             </div>
                        )}

                        <div className="pt-2">
                            <button onClick={applyProjection} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded shadow-sm">
                                Aplicar Proyección
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default BudgetGrid;
