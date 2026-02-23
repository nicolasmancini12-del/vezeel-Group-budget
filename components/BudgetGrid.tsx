import React, { useState, useRef, useMemo } from 'react';
import { BudgetEntry, CategoryType, AppConfig, ExchangeRate, BudgetVersion, CategoryAssignment } from '../types';
import { MONTHS, generateId, CONSOLIDATED_ID, CONSOLIDATED_NAME } from '../constants';
import { Download, Upload, Zap, X, FileBarChart, User, Settings2, Calculator } from 'lucide-react'; 
import { excelService } from '../services/excelService';

interface BudgetGridProps {
  entries: BudgetEntry[];
  exchangeRates: ExchangeRate[];
  companyName: string;
  versionId: string;
  config: AppConfig;
  allVersions: BudgetVersion[];
  onUpdateEntry: (entry: BudgetEntry) => void;
  onUpdateRate: (rate: ExchangeRate) => void;
  onBulkUpdate?: (entries: BudgetEntry[], mode: 'plan' | 'real') => void;
  onBulkRateUpdate?: (rates: ExchangeRate[]) => void;
}

const BudgetGrid: React.FC<BudgetGridProps> = ({ 
    entries, 
    exchangeRates, 
    companyName, 
    versionId, 
    config, 
    allVersions,
    onUpdateEntry, 
    onUpdateRate,
    onBulkUpdate,
    onBulkRateUpdate
}) => {
  const [dataMode, setDataMode] = useState<'plan' | 'real'>('plan');
  const [viewMode, setViewMode] = useState<'quantities' | 'master'>('quantities');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const masterFileInputRef = useRef<HTMLInputElement>(null);
  
  const isConsolidated = companyName === CONSOLIDATED_ID;
  const companyConfig = config.companies.find(c => c.name.trim().toLowerCase() === companyName.trim().toLowerCase());
  const currency = isConsolidated ? 'USD' : (companyConfig?.currency || 'USD');

  const [projModal, setProjModal] = useState<{ isOpen: boolean; cat: CategoryType | null; sub: string | null; client: string | null } | null>(null);
  const [projMethod, setProjMethod] = useState<'replicate' | 'adjust'>('replicate');
  const [projValue, setProjValue] = useState('');

  const openProjection = (cat: CategoryType, sub: string, client: string) => {
    setProjModal({ isOpen: true, cat, sub, client });
    setProjValue('');
    setProjMethod('replicate');
  };

  const getRelevantAssignments = (cat: CategoryType): CategoryAssignment[] => {
      if (isConsolidated) {
          const pairs = new Set<string>();
          const result: CategoryAssignment[] = [];
          config.assignments.filter(a => a.categoryType === cat).forEach(a => {
              const key = `${a.categoryName.trim().toLowerCase()}|${(a.clientName || '').trim().toLowerCase()}`;
              if (!pairs.has(key)) {
                  pairs.add(key);
                  result.push({ ...a, companyName: CONSOLIDATED_ID });
              }
          });
          return result;
      }
      
      const targetCo = companyName.trim().toLowerCase();
      return config.assignments.filter(a => 
          a.companyName.trim().toLowerCase() === targetCo && 
          a.categoryType === cat
      );
  };

  const getEntry = (cat: CategoryType, sub: string, client: string, monthIdx: number): BudgetEntry => {
    const monthNum = monthIdx + 1;
    const cleanSub = sub.trim().toLowerCase();
    const cleanClient = (client || '').trim().toLowerCase();

    if (isConsolidated) {
        const relevantEntries = entries.filter(e => {
            if (e.versionId !== versionId) return false;
            if (e.category !== cat) return false;
            if (e.subCategory.trim().toLowerCase() !== cleanSub) return false;
            if ((e.client || '').trim().toLowerCase() !== cleanClient) return false;
            if (e.month !== monthNum) return false;
            return true;
        });

        let totalPlanVal = 0, totalPlanUnits = 0, totalRealVal = 0, totalRealUnits = 0;
        let totalSalePrice = 0, totalUnitCost = 0, totalRealSalePrice = 0, totalRealUnitCost = 0;

        relevantEntries.forEach(entry => {
            const comp = config.companies.find(c => c.name.trim().toLowerCase() === entry.company.trim().toLowerCase());
            if (!comp) return;
            let planRate = 1, realRate = 1;
            if (comp.currency !== 'USD') {
                const rateObj = exchangeRates.find(r => r.company.trim().toLowerCase() === entry.company.trim().toLowerCase() && r.versionId === versionId && r.month === monthNum);
                planRate = rateObj?.planRate || 1;
                realRate = rateObj?.realRate || 1;
            }
            totalPlanVal += (entry.planValue / planRate);
            totalRealVal += (entry.realValue / realRate);
            totalPlanUnits += entry.planUnits;
            totalRealUnits += entry.realUnits;
            totalSalePrice += (entry.salePrice || 0);
            totalUnitCost += (entry.unitDirectCost || 0);
            totalRealSalePrice += (entry.realSalePrice || 0);
            totalRealUnitCost += (entry.realUnitDirectCost || 0);
        });

        return {
            id: `cons-${monthIdx}-${cat}-${sub}-${client}`, month: monthNum, year: 2026, company: CONSOLIDATED_ID,
            category: cat, subCategory: sub, client, planValue: totalPlanVal, planUnits: totalPlanUnits,
            realValue: totalRealVal, realUnits: totalRealUnits, versionId,
            salePrice: relevantEntries.length ? totalSalePrice / relevantEntries.length : 0,
            unitDirectCost: relevantEntries.length ? totalUnitCost / relevantEntries.length : 0,
            realSalePrice: relevantEntries.length ? totalRealSalePrice / relevantEntries.length : 0,
            realUnitDirectCost: relevantEntries.length ? totalRealUnitCost / relevantEntries.length : 0
        };
    }

    const targetCo = companyName.trim().toLowerCase();
    const existing = entries.find(e => 
        e.company.trim().toLowerCase() === targetCo && 
        e.versionId === versionId && 
        e.month === monthNum && 
        e.category === cat && 
        e.subCategory.trim().toLowerCase() === cleanSub &&
        (e.client || '').trim().toLowerCase() === cleanClient
    );

    if (existing) return existing;

    return {
      id: generateId(), month: monthNum, year: 2026, company: companyName, category: cat, subCategory: sub, client,
      planValue: 0, planUnits: 0, realValue: 0, realUnits: 0, versionId, salePrice: 0, unitDirectCost: 0, realSalePrice: 0, realUnitDirectCost: 0
    };
  };

  const handleGridChange = (cat: CategoryType, sub: string, client: string, monthIdx: number, field: 'Q' | 'MasterValue', valueStr: string) => {
    if (isConsolidated) return;
    if (valueStr !== '' && !/^\d*\.?\d*$/.test(valueStr)) return;
    const val = valueStr === '' ? 0 : parseFloat(valueStr);
    const entry = getEntry(cat, sub, client, monthIdx);
    let newEntry = { ...entry };

    if (viewMode === 'master') {
        if (cat === 'Ingresos') {
            if (dataMode === 'plan') {
                newEntry.salePrice = val;
                newEntry.planValue = newEntry.planUnits * val;
            } else {
                newEntry.realSalePrice = val;
                newEntry.realValue = newEntry.realUnits * val;
            }
        } else if (cat === 'Costos Directos') {
            if (dataMode === 'plan') {
                newEntry.unitDirectCost = val;
                newEntry.planValue = newEntry.planUnits * val;
            } else {
                newEntry.realUnitDirectCost = val;
                newEntry.realValue = newEntry.realUnits * val;
            }
        } else {
            if (dataMode === 'plan') { newEntry.planUnits = 1; newEntry.planValue = val; }
            else { newEntry.realUnits = 1; newEntry.realValue = val; }
        }
    } else {
        if (dataMode === 'plan') {
            newEntry.planUnits = val;
            const price = cat === 'Ingresos' ? (entry.salePrice || 0) : (entry.unitDirectCost || 0);
            newEntry.planValue = val * (price || 0);
        } else {
            newEntry.realUnits = val;
            const price = cat === 'Ingresos' ? (entry.realSalePrice || 0) : (entry.realUnitDirectCost || 0);
            newEntry.realValue = val * (price || 0);
        }
    }
    onUpdateEntry(newEntry);
  };

  const getCategoryTotal = (cat: CategoryType, monthIdx: number) => {
      let subtotal = 0;
      const catAssignments = getRelevantAssignments(cat);
      catAssignments.forEach(a => {
          const entry = getEntry(cat, a.categoryName, a.clientName || '', monthIdx);
          subtotal += dataMode === 'plan' ? entry.planValue : entry.realValue;
      });
      return subtotal;
  };

  const monthlyTotals = useMemo(() => {
    return MONTHS.map((_, idx) => {
        const ingresos = getCategoryTotal('Ingresos', idx);
        const directos = getCategoryTotal('Costos Directos', idx);
        const indirectos = getCategoryTotal('Costos Indirectos', idx);
        return ingresos - directos - indirectos;
    });
  }, [entries, companyName, versionId, dataMode, config, exchangeRates]);

  const renderGridRow = (cat: CategoryType, sub: string, client: string) => {
    const cells = MONTHS.map((_, idx) => {
        const entry = getEntry(cat, sub, client, idx);
        const Q = dataMode === 'plan' ? entry.planUnits : entry.realUnits;
        const Total = dataMode === 'plan' ? entry.planValue : entry.realValue;
        
        let masterVal = 0;
        if (dataMode === 'plan') {
            if (cat === 'Ingresos') masterVal = entry.salePrice || 0;
            else if (cat === 'Costos Directos') masterVal = entry.unitDirectCost || 0;
            else masterVal = Total;
        } else {
            if (cat === 'Ingresos') masterVal = entry.realSalePrice || 0;
            else if (cat === 'Costos Directos') masterVal = entry.realUnitDirectCost || 0;
            else masterVal = Total;
        }

        const masterColor = dataMode === 'plan' ? 'text-gray-400' : 'text-purple-400';
        const inputBorder = dataMode === 'plan' ? 'border-gray-100' : 'border-purple-100';
        const inputBg = dataMode === 'plan' ? 'bg-slate-50' : 'bg-purple-50/30';

        return (
            <td key={idx} className={`border-r border-gray-200 p-1 min-w-[120px] ${isConsolidated ? 'bg-indigo-50/30' : 'bg-white hover:bg-slate-50'} transition-colors`}>
                <div className="flex flex-col gap-1">
                    {viewMode === 'quantities' ? (
                        <div className="flex flex-col gap-1">
                            <div className="relative">
                                <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 font-bold">Q</span>
                                <input type="text" inputMode="decimal" disabled={isConsolidated} className={`w-full text-right text-xs border rounded outline-none px-1 py-1 pl-3 ${isConsolidated ? 'bg-transparent text-gray-600 font-medium' : `${inputBg} ${inputBorder} focus:bg-white focus:border-blue-400`}`} value={Q === 0 ? '' : Q} placeholder="0" onChange={(e) => handleGridChange(cat, sub, client, idx, 'Q', e.target.value)} />
                            </div>
                            <div className="flex justify-between items-center px-1">
                                <span className={`text-[9px] ${masterColor} italic`}>P: {masterVal.toLocaleString()}</span>
                                <span className={`text-xs font-bold ${Total > 0 ? (dataMode === 'plan' ? 'text-slate-700' : 'text-purple-700') : 'text-gray-300'}`}>
                                    {Total.toLocaleString('es-AR', { style: 'currency', currency: currency })}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="relative">
                             <span className={`absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-bold ${dataMode === 'plan' ? 'text-blue-400' : 'text-purple-400'}`}>$</span>
                             <input type="text" inputMode="decimal" disabled={isConsolidated} className={`w-full text-right text-xs border rounded outline-none px-1 py-1.5 pl-3 font-bold ${dataMode === 'plan' ? 'bg-blue-50/30 border-blue-100 text-blue-700 focus:border-blue-400' : 'bg-purple-50/30 border-purple-100 text-purple-700 focus:border-purple-400'} focus:bg-white`} value={masterVal === 0 ? '' : masterVal} placeholder="0.00" onChange={(e) => handleGridChange(cat, sub, client, idx, 'MasterValue', e.target.value)} />
                        </div>
                    )}
                </div>
            </td>
        );
    });

    return (
        <tr key={`${sub}-${client}`} className="border-b border-gray-100 hover:bg-gray-50 group">
            <td className="sticky left-0 bg-white z-10 border-r border-gray-200 p-2 shadow-sm min-w-[200px]">
                 <div className="flex flex-col">
                    <div className="flex justify-between items-center">
                        <div className="truncate text-sm font-medium text-slate-700" title={sub}>{sub}</div>
                        {!isConsolidated && (
                            <button onClick={() => openProjection(cat, sub, client)} className="opacity-0 group-hover:opacity-100 transition-opacity text-amber-500 hover:bg-amber-50 p-1 rounded" title="Proyectar">
                                <Zap size={14} fill="currentColor" />
                            </button>
                        )}
                    </div>
                    {client && (
                        <div className="flex items-center gap-1 mt-1">
                            <User size={10} className="text-indigo-400" />
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full uppercase tracking-tight">{client}</span>
                        </div>
                    )}
                 </div>
            </td>
            {cells}
        </tr>
    );
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'plan' | 'real') => {
      if (e.target.files && e.target.files[0] && onBulkUpdate) {
          try {
              const imported = await excelService.importBudget(e.target.files[0], companyName, versionId, mode);
              if (confirm(`Se actualizarán ${imported.length} registros para la vista ${mode.toUpperCase()}. ¿Continuar?`)) {
                  onBulkUpdate(imported, mode);
              }
          } catch (error) { alert("Error al importar"); }
      }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
        <div className="p-4 border-b border-gray-200 bg-slate-50 flex justify-between items-center flex-wrap gap-2">
            <div className="flex gap-4 items-center">
                <div className="flex bg-white border rounded-lg p-1 shadow-sm">
                    <button onClick={() => setDataMode('plan')} className={`px-3 py-1 text-xs font-bold rounded ${dataMode === 'plan' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-blue-400'}`}>Plan</button>
                    <button onClick={() => setDataMode('real')} className={`px-3 py-1 text-xs font-bold rounded ${dataMode === 'real' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-purple-400'}`}>Real</button>
                </div>
                
                <div className="h-6 w-px bg-gray-300"></div>

                <div className="flex bg-slate-200 border rounded-lg p-1 shadow-inner">
                    <button onClick={() => setViewMode('quantities')} className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded transition-all ${viewMode === 'quantities' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                        <Calculator size={14}/> Cantidades
                    </button>
                    <button onClick={() => setViewMode('master')} className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded transition-all ${viewMode === 'master' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
                        <Settings2 size={14}/> Maestro P/C
                    </button>
                </div>
            </div>

            <div className="flex gap-2 flex-wrap">
                {!isConsolidated && (
                    <>
                    <input type="file" ref={fileInputRef} onChange={(e) => handleImportExcel(e, dataMode)} className="hidden" accept=".xlsx" />
                    
                    <button onClick={() => fileInputRef.current?.click()} className={`flex items-center gap-2 px-3 py-1.5 border rounded text-sm font-semibold transition-colors ${dataMode === 'plan' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'}`}>
                        <Upload size={16} /> Importar {dataMode.toUpperCase()}
                    </button>
                    </>
                )}
                <button onClick={() => excelService.exportSummary(entries, config.companies, allVersions.find(v => v.id === versionId)!, exchangeRates, companyName)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 font-semibold border border-blue-200">
                    <FileBarChart size={16} /> Resumen
                </button>
                <button onClick={() => excelService.exportBudget(entries.filter(e => e.versionId === versionId), isConsolidated ? CONSOLIDATED_NAME : companyName, config.assignments, dataMode)} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm text-white font-bold shadow-sm ${dataMode === 'plan' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-purple-600 hover:bg-purple-700'}`}>
                    <Download size={16} /> Excel {dataMode.toUpperCase()}
                </button>
            </div>
        </div>

        <div className={`px-4 py-2 border-b flex gap-6 text-[11px] font-medium transition-colors ${dataMode === 'plan' ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-purple-50 border-purple-100 text-purple-800'}`}>
            {viewMode === 'quantities' ? (
                <>
                <div className="flex items-center gap-2"><span className="font-bold bg-white border px-1 rounded">Q</span> Cantidad {dataMode.toUpperCase()}</div>
                <div className="flex items-center gap-2"><span className="font-bold">P</span> Precio Maestro ({dataMode.toUpperCase()})</div>
                </>
            ) : (
                <div className="flex items-center gap-2 font-bold"><Settings2 size={12}/> MAESTRO DE PRECIOS Y COSTOS UNITARIOS: MODO {dataMode.toUpperCase()}</div>
            )}
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar relative">
            <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
                    <tr>
                        <th className="sticky left-0 top-0 z-30 bg-slate-100 p-3 text-left w-[200px] text-xs font-bold text-gray-500 uppercase border-b border-r border-gray-200">Concepto / Cliente</th>
                        {MONTHS.map(m => (
                            <th key={m} className="p-2 text-center min-w-[120px] text-xs font-bold text-gray-500 uppercase border-b border-gray-200 border-r">{m}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {(['Ingresos', 'Costos Directos', 'Costos Indirectos'] as CategoryType[]).map(cat => {
                        const assignments = getRelevantAssignments(cat);
                        return (
                             <React.Fragment key={cat}>
                                <tr className="bg-gray-100"><td colSpan={13} className="px-4 py-1.5 text-[10px] font-black text-gray-500 uppercase border-b tracking-widest">{cat}</td></tr>
                                {assignments.map(a => renderGridRow(cat, a.categoryName, a.clientName || ''))}
                                {viewMode === 'quantities' && (
                                    <tr className={`font-bold border-t border-gray-200 shadow-inner ${dataMode === 'plan' ? 'bg-gray-50/80 text-slate-600' : 'bg-purple-50/20 text-purple-600'}`}>
                                        <td className="sticky left-0 bg-inherit z-10 p-2 text-xs uppercase text-right pr-4 border-r border-gray-300">Total {cat} ({dataMode.toUpperCase()})</td>
                                        {MONTHS.map((_, idx) => (
                                            <td key={idx} className="p-2 text-right border-r border-gray-200 text-xs">
                                                {getCategoryTotal(cat, idx).toLocaleString('es-AR', { style: 'currency', currency: currency })}
                                            </td>
                                        ))}
                                    </tr>
                                )}
                             </React.Fragment>
                        );
                    })}
                </tbody>
                {viewMode === 'quantities' && (
                    <tfoot className={`sticky bottom-0 z-20 text-white shadow-lg border-t-2 ${dataMode === 'plan' ? 'bg-slate-800 border-slate-600' : 'bg-purple-900 border-purple-700'}`}>
                        <tr>
                            <td className="sticky left-0 bottom-0 z-30 bg-inherit p-3 text-left font-bold text-xs uppercase border-r border-slate-600">RESULTADO NETO {dataMode.toUpperCase()} ({currency})</td>
                            {monthlyTotals.map((val, idx) => (
                                <td key={idx} className="p-2 text-right min-w-[120px] border-r border-slate-600">
                                    <span className={`text-sm font-bold ${val >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {val.toLocaleString('es-AR', { style: 'currency', currency: currency })}
                                    </span>
                                </td>
                            ))}
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
        
        {projModal && projModal.isOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                    <div className="bg-amber-50 p-4 border-b border-amber-100 flex justify-between items-center">
                        <h3 className="font-bold text-amber-800 flex items-center gap-2"><Zap size={18} fill="currentColor" /> Proyección {dataMode.toUpperCase()}</h3>
                        <button onClick={() => setProjModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                    </div>
                    <div className="p-6 space-y-4 text-sm">
                        <p>Aplica una regla desde Enero hacia el resto del año para {dataMode.toUpperCase()}.</p>
                        <select value={projMethod} onChange={(e: any) => setProjMethod(e.target.value)} className="w-full border rounded p-2 bg-white">
                            <option value="replicate">Replicar valor de Enero</option>
                            <option value="adjust">Incremento % Mensual</option>
                        </select>
                        {projMethod === 'adjust' && (
                             <input type="number" value={projValue} onChange={(e) => setProjValue(e.target.value)} placeholder="% mensual..." className="w-full border rounded p-2" />
                        )}
                        <button onClick={() => {
                            const newEntries: BudgetEntry[] = [];
                            const jan = getEntry(projModal.cat!, projModal.sub!, projModal.client!, 0);
                            
                            let baseVal = 0;
                            if (viewMode === 'master') {
                                if (dataMode === 'plan') baseVal = (projModal.cat === 'Ingresos' ? jan.salePrice : jan.unitDirectCost) || 0;
                                else baseVal = (projModal.cat === 'Ingresos' ? jan.realSalePrice : jan.realUnitDirectCost) || 0;
                            } else {
                                baseVal = (dataMode === 'plan' ? jan.planUnits : jan.realUnits) || 0;
                            }
                            
                            for(let i=1; i<12; i++) {
                                let e = { ...getEntry(projModal.cat!, projModal.sub!, projModal.client!, i) };
                                let multi = projMethod === 'adjust' ? Math.pow(1 + (parseFloat(projValue)/100), i) : 1;
                                let newVal = (baseVal || 0) * multi;

                                if (viewMode === 'master') {
                                    if (dataMode === 'plan') {
                                        if(projModal.cat === 'Ingresos') e.salePrice = newVal;
                                        else e.unitDirectCost = newVal;
                                        e.planValue = e.planUnits * newVal;
                                    } else {
                                        if(projModal.cat === 'Ingresos') e.realSalePrice = newVal;
                                        else e.realUnitDirectCost = newVal;
                                        e.realValue = e.realUnits * newVal;
                                    }
                                } else {
                                    if(dataMode === 'plan') {
                                        e.planUnits = newVal;
                                        e.planValue = newVal * (projModal.cat === 'Ingresos' ? (e.salePrice || 0) : (e.unitDirectCost || 0));
                                    } else {
                                        e.realUnits = newVal;
                                        e.realValue = newVal * (projModal.cat === 'Ingresos' ? (e.realSalePrice || 0) : (e.realUnitDirectCost || 0));
                                    }
                                }
                                newEntries.push(e);
                            }
                            onBulkUpdate?.(newEntries, dataMode);
                            setProjModal(null);
                        }} className={`w-full text-white font-bold py-2 rounded shadow-sm ${dataMode === 'plan' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}>Aplicar a todo el año</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default BudgetGrid;