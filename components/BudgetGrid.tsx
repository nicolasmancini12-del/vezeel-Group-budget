import React, { useState, useRef, useMemo } from 'react';
import { BudgetEntry, CategoryType, AppConfig, ExchangeRate, BudgetVersion, CategoryAssignment } from '../types';
import { MONTHS, generateId, CONSOLIDATED_ID, CONSOLIDATED_NAME } from '../constants';
import { Download, Upload, Zap, X, FileBarChart, User } from 'lucide-react'; 
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
  onBulkUpdate?: (entries: BudgetEntry[]) => void;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isConsolidated = companyName === CONSOLIDATED_ID;
  const companyConfig = config.companies.find(c => c.name.trim().toLowerCase() === companyName.trim().toLowerCase());
  const currency = isConsolidated ? 'USD' : (companyConfig?.currency || 'USD');

  // --- Projection State ---
  const [projModal, setProjModal] = useState<{ isOpen: boolean; cat: CategoryType | null; sub: string | null; client: string | null } | null>(null);
  const [projTarget, setProjTarget] = useState<'Q' | 'P'>('Q');
  const [projMethod, setProjMethod] = useState<'replicate' | 'adjust'>('replicate');
  const [projValue, setProjValue] = useState('');

  // --- Helpers for Filtering (Robust matching) ---
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

  // --- Excel Handlers ---
  const handleExport = () => {
    if (isConsolidated) {
        excelService.exportBudget(entries.filter(e => e.versionId === versionId), "GRUPO VEZEEL (Consolidado)");
    } else {
        excelService.exportBudget(entries.filter(e => e.company.trim().toLowerCase() === companyName.trim().toLowerCase() && e.versionId === versionId), companyName);
    }
  };

  const handleExportSummary = () => {
      const versionObj = allVersions.find(v => v.id === versionId);
      if (versionObj) {
          excelService.exportSummary(entries, config.companies, versionObj, exchangeRates, companyName);
      }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && onBulkUpdate) {
        try {
            const importedEntries = await excelService.importBudget(e.target.files[0], companyName, versionId);
            if (importedEntries.length === 0) {
                alert("No se encontraron datos en el archivo seleccionado.");
                return;
            }
            if (confirm(`Se encontraron ${importedEntries.length} registros. ¿Desea importarlos y sobrescribir?`)) {
                onBulkUpdate(importedEntries);
            }
        } catch (error) {
            console.error("Import error:", error);
            alert('Error al leer el archivo Excel. Asegúrese de que el formato sea correcto.');
        }
    }
  };

  // --- Grid Logic ---
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

        let totalPlanVal = 0;
        let totalPlanUnits = 0;
        let totalRealVal = 0;
        let totalRealUnits = 0;

        relevantEntries.forEach(entry => {
            const comp = config.companies.find(c => c.name.trim().toLowerCase() === entry.company.trim().toLowerCase());
            if (!comp) return;
            let planRate = 1;
            let realRate = 1;
            if (comp.currency !== 'USD') {
                const rateObj = exchangeRates.find(r => 
                    r.company.trim().toLowerCase() === entry.company.trim().toLowerCase() && 
                    r.versionId === versionId && 
                    r.month === monthNum
                );
                planRate = rateObj?.planRate || 1;
                realRate = rateObj?.realRate || 1;
            }
            totalPlanVal += (entry.planValue / planRate);
            totalRealVal += (entry.realValue / realRate);
            totalPlanUnits += entry.planUnits;
            totalRealUnits += entry.realUnits;
        });

        return {
            id: `cons-${monthIdx}-${cat}-${sub}-${client}`, month: monthNum, year: 2026, company: CONSOLIDATED_ID,
            category: cat, subCategory: sub, client, planValue: totalPlanVal, planUnits: totalPlanUnits,
            realValue: totalRealVal, realUnits: totalRealUnits, versionId
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
      planValue: 0, planUnits: 0, realValue: 0, realUnits: 0, versionId
    };
  };

  const handlePxQChange = (cat: CategoryType, sub: string, client: string, monthIdx: number, type: 'Q' | 'P', valueStr: string) => {
    if (isConsolidated) return;
    if (valueStr !== '' && !/^\d*\.?\d*$/.test(valueStr)) return;
    const entry = getEntry(cat, sub, client, monthIdx);
    const val = valueStr === '' ? 0 : parseFloat(valueStr);
    let newEntry = { ...entry };

    if (dataMode === 'plan') {
        const currentQ = entry.planUnits;
        const currentTotal = entry.planValue;
        const currentP = currentQ !== 0 ? currentTotal / currentQ : 0;
        if (type === 'Q') {
            newEntry.planUnits = val;
            newEntry.planValue = val * (currentP || 0);
        } else {
            if (currentQ === 0 && val !== 0) {
                newEntry.planUnits = 1;
                newEntry.planValue = val;
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
            newEntry.realValue = val * (currentP || 0);
        } else {
            if (currentQ === 0 && val !== 0) {
                newEntry.realUnits = 1;
                newEntry.realValue = val;
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

  const handleRateChange = (monthIdx: number, valueStr: string) => {
      if (isConsolidated) return;
      if (valueStr !== '' && !/^\d*\.?\d*$/.test(valueStr)) return;
      const val = valueStr === '' ? 0 : parseFloat(valueStr);
      const monthNum = monthIdx + 1;
      const targetCompanies = config.companies.filter(c => c.currency === currency);
      const ratesToUpdate: ExchangeRate[] = targetCompanies.map(targetComp => {
          const existingRate = exchangeRates.find(r => r.company.trim().toLowerCase() === targetComp.name.trim().toLowerCase() && r.versionId === versionId && r.month === monthNum);
          const newRate: ExchangeRate = existingRate ? { ...existingRate } : {
              id: generateId(), company: targetComp.name, month: monthNum, year: 2026, versionId, planRate: 1, realRate: 1
          };
          if (dataMode === 'plan') newRate.planRate = val;
          else newRate.realRate = val;
          return newRate;
      });
      if (onBulkRateUpdate && ratesToUpdate.length > 0) onBulkRateUpdate(ratesToUpdate);
      else if (ratesToUpdate.length > 0) onUpdateRate(ratesToUpdate[0]);
  };

  const openProjection = (cat: CategoryType, sub: string, client: string) => {
      setProjModal({ isOpen: true, cat, sub, client });
      setProjTarget('Q');
      setProjMethod('replicate');
      setProjValue('');
  };

  const applyProjection = () => {
      if (!projModal || !onBulkUpdate) return;
      const { cat, sub, client } = projModal;
      if(!cat || !sub) return;
      const newEntries: BudgetEntry[] = [];
      const janEntry = getEntry(cat, sub, client || '', 0);
      const janQ = dataMode === 'plan' ? janEntry.planUnits : janEntry.realUnits;
      const janP = getPrice(janEntry, dataMode);
      const baseVal = projTarget === 'Q' ? janQ : janP;
      const rate = projMethod === 'adjust' ? (parseFloat(projValue) / 100) : 0;
      for (let i = 1; i < 12; i++) {
          const entry = getEntry(cat, sub, client || '', i);
          const currentP = getPrice(entry, dataMode);
          const currentQ = dataMode === 'plan' ? entry.planUnits : entry.realUnits;
          let newVal = baseVal;
          if (projMethod === 'adjust') newVal = baseVal * Math.pow(1 + rate, i);
          let updatedEntry = { ...entry };
          if (dataMode === 'plan') {
              if (projTarget === 'Q') {
                  updatedEntry.planUnits = newVal;
                  const effectiveP = currentP !== 0 ? currentP : janP;
                  updatedEntry.planValue = newVal * (effectiveP || 0);
              } else {
                  const effectiveQ = currentQ === 0 ? 1 : currentQ; 
                  if(currentQ === 0) updatedEntry.planUnits = 1;
                  updatedEntry.planValue = effectiveQ * newVal;
              }
          } else {
               if (projTarget === 'Q') {
                  updatedEntry.realUnits = newVal;
                  const effectiveP = currentP !== 0 ? currentP : janP;
                  updatedEntry.realValue = newVal * (effectiveP || 0);
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
        const P = getPrice(entry, dataMode);
        return (
            <td key={idx} className={`border-r border-gray-200 p-1 min-w-[120px] ${isConsolidated ? 'bg-indigo-50/30' : 'bg-white hover:bg-slate-50'} transition-colors`}>
                <div className="flex flex-col gap-1">
                    <div className="flex gap-1">
                        <div className="relative flex-1">
                            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 font-bold">Q</span>
                            <input type="text" inputMode="decimal" disabled={isConsolidated} className={`w-full text-right text-xs border border-gray-100 rounded outline-none px-1 py-1 pl-3 ${isConsolidated ? 'bg-transparent text-gray-600 font-medium' : 'bg-slate-50 focus:bg-white focus:border-blue-400'}`} value={Q === 0 ? '' : Q} placeholder="0" onChange={(e) => handlePxQChange(cat, sub, client, idx, 'Q', e.target.value)} />
                        </div>
                        <div className="relative flex-1">
                            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 font-bold">{isConsolidated ? 'US' : '$'}</span>
                            <input type="text" inputMode="decimal" disabled={isConsolidated} className={`w-full text-right text-xs border border-gray-100 rounded outline-none px-1 py-1 pl-3 ${isConsolidated ? 'bg-transparent text-gray-600 font-medium' : 'bg-slate-50 focus:bg-white focus:border-blue-400'}`} value={P === 0 ? '' : P} placeholder="0" onChange={(e) => handlePxQChange(cat, sub, client, idx, 'P', e.target.value)} />
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
        <tr key={`${sub}-${client}`} className="border-b border-gray-100 hover:bg-gray-50 group">
            <td className="sticky left-0 bg-white z-10 border-r border-gray-200 p-2 shadow-sm min-w-[200px]">
                 <div className="flex flex-col">
                    <div className="flex justify-between items-center">
                        <div className="truncate text-sm font-medium text-slate-700" title={sub}>{sub}</div>
                        {!isConsolidated && dataMode === 'plan' && (
                            <button onClick={() => openProjection(cat, sub, client)} className="opacity-0 group-hover:opacity-100 transition-opacity text-amber-500 hover:bg-amber-50 p-1 rounded" title="Proyectar (Replicar o %)">
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

  const renderExchangeRateRow = () => {
      if (isConsolidated || currency === 'USD') return null;
      return (
          <tr className="bg-blue-50/50 border-b border-blue-100 shadow-inner">
              <td className="sticky left-0 bg-blue-50 z-20 border-r border-blue-100 p-3 shadow-sm">
                  <div className="text-xs font-bold text-blue-800">TIPO DE CAMBIO ({currency}/USD)</div>
                  <div className="text-[10px] text-blue-600 mt-0.5">Editable Mensual</div>
              </td>
              {MONTHS.map((_, idx) => {
                  const monthNum = idx + 1;
                  const targetCo = companyName.trim().toLowerCase();
                  const rateObj = exchangeRates.find(r => r.company.trim().toLowerCase() === targetCo && r.versionId === versionId && r.month === monthNum);
                  const val = dataMode === 'plan' ? rateObj?.planRate : rateObj?.realRate;
                  return (
                      <td key={idx} className="p-2 border-r border-blue-100 min-w-[120px]">
                          <input type="text" inputMode="decimal" value={val === 0 || val === undefined ? '' : val} onChange={(e) => handleRateChange(idx, e.target.value)} placeholder="1.00" className="w-full text-right text-xs bg-white border border-blue-200 rounded px-2 py-1.5 font-bold text-blue-700 focus:ring-2 focus:ring-blue-400 outline-none" />
                      </td>
                  );
              })}
          </tr>
      )
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
        <div className="p-4 border-b border-gray-200 bg-slate-50 flex justify-between items-center flex-wrap gap-2">
            <div className="flex gap-2">
                <button onClick={() => setDataMode('plan')} className={`px-3 py-1.5 text-sm font-medium rounded ${dataMode === 'plan' ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>Plan</button>
                <button onClick={() => setDataMode('real')} className={`px-3 py-1.5 text-sm font-medium rounded ${dataMode === 'real' ? 'bg-purple-600 text-white shadow' : 'bg-white text-gray-600 border'}`}>Real</button>
            </div>
            
             <div className="flex-1 px-4 overflow-x-auto min-w-[200px]">
                <div className="flex gap-4">
                    {config.companies.filter(c => c.currency !== 'USD').map(c => {
                         const rate = exchangeRates.find(r => r.company.trim().toLowerCase() === c.name.trim().toLowerCase() && r.versionId === versionId && r.month === 1);
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

            <div className="flex gap-2 flex-wrap">
                {!isConsolidated && (
                    <>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx,.xls" />
                    <button onClick={handleImportClick} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">
                        <Upload size={16} /> Importar Datos
                    </button>
                    </>
                )}
                <button onClick={handleExportSummary} className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 font-semibold border border-blue-200">
                    <FileBarChart size={16} /> Resumen Excel
                </button>
                <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 shadow-sm">
                    <Download size={16} /> Exportar Detalle
                </button>
            </div>
        </div>

        <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 flex gap-6 text-xs text-blue-800">
            <div className="flex items-center gap-2"><span className="font-bold bg-white border border-blue-200 px-1 rounded">Q</span> Cantidad</div>
            <div className="flex items-center gap-2"><span className="font-bold bg-white border border-blue-200 px-1 rounded">$</span> {isConsolidated ? 'Precio Promedio (USD)' : 'Precio Unitario'}</div>
            <div className="flex items-center gap-2"><span className="font-bold">Total</span> {isConsolidated ? '(Consolidado USD)' : '(Automático)'}</div>
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
                    {renderExchangeRateRow()}
                    {(['Ingresos', 'Costos Directos', 'Costos Indirectos'] as CategoryType[]).map(cat => {
                        const assignments = getRelevantAssignments(cat);
                        return (
                             <React.Fragment key={cat}>
                                <tr className="bg-gray-100"><td colSpan={13} className="px-4 py-2 text-xs font-bold text-gray-600 uppercase border-b">{cat}</td></tr>
                                {assignments.length === 0 ? (
                                    <tr><td colSpan={13} className="px-8 py-4 text-sm text-gray-400 italic text-center">No hay conceptos asignados a "{cat}" para esta empresa.</td></tr>
                                ) : (
                                    assignments.map(a => renderGridRow(cat, a.categoryName, a.clientName || ''))
                                )}
                                <tr className="bg-gray-200/50 font-bold text-slate-600 border-t border-gray-300 shadow-inner">
                                    <td className="sticky left-0 bg-gray-100 z-10 p-2 text-xs uppercase text-right pr-4 border-r border-gray-300">Subtotal {cat}</td>
                                    {MONTHS.map((_, idx) => (
                                        <td key={idx} className="p-2 text-right border-r border-gray-200 text-xs">
                                            {getCategoryTotal(cat, idx).toLocaleString('es-AR', { style: 'currency', currency: currency })}
                                        </td>
                                    ))}
                                </tr>
                             </React.Fragment>
                        );
                    })}
                </tbody>
                <tfoot className="sticky bottom-0 z-20 bg-slate-800 text-white shadow-lg border-t-2 border-slate-600">
                    <tr>
                        <td className="sticky left-0 bottom-0 z-30 bg-slate-800 p-3 text-left font-bold text-xs uppercase border-r border-slate-600">RESULTADO NETO ({currency})</td>
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

        {projModal && projModal.isOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                    <div className="bg-amber-50 p-4 border-b border-amber-100 flex justify-between items-center">
                        <h3 className="font-bold text-amber-800 flex items-center gap-2"><Zap size={18} fill="currentColor" /> Proyección Rápida</h3>
                        <button onClick={() => setProjModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="text-sm text-gray-600">Proyectando: <strong>{projModal.sub}</strong> {projModal.client ? `(${projModal.client})` : ''}</div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Variable</label>
                            <div className="flex gap-2">
                                <button onClick={() => setProjTarget('Q')} className={`flex-1 py-2 text-sm rounded border ${projTarget === 'Q' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'}`}>Cantidad (Q)</button>
                                <button onClick={() => setProjTarget('P')} className={`flex-1 py-2 text-sm rounded border ${projTarget === 'P' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'}`}>Precio ($)</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Método</label>
                            <select value={projMethod} onChange={(e: any) => setProjMethod(e.target.value)} className="w-full border rounded p-2 text-sm bg-white">
                                <option value="replicate">Replicar Enero</option>
                                <option value="adjust">Ajuste % Mensual</option>
                            </select>
                        </div>
                        {projMethod === 'adjust' && (
                             <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">% Crecimiento Mensual</label>
                                <input type="number" value={projValue} onChange={(e) => setProjValue(e.target.value)} placeholder="Ej: 5 (para 5%)" className="w-full border rounded p-2 text-sm" />
                             </div>
                        )}
                        <div className="pt-2">
                            <button onClick={applyProjection} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded shadow-sm">Aplicar Proyección</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default BudgetGrid;