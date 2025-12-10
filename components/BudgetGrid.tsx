
import React, { useState } from 'react';
import { BudgetEntry, CategoryType, AppConfig, ExchangeRate } from '../types';
import { MONTHS, generateId, CONSOLIDATED_ID } from '../constants';

interface BudgetGridProps {
  entries: BudgetEntry[];
  exchangeRates: ExchangeRate[];
  companyName: string;
  versionId: string;
  config: AppConfig;
  onUpdateEntry: (entry: BudgetEntry) => void;
  onUpdateRate: (rate: ExchangeRate) => void;
}

// Helper for bulk updates
interface ProjectionModalProps {
    conceptName: string;
    onClose: () => void;
    onApply: (type: 'CONSTANT' | 'PERCENTAGE', value: number) => void;
}

const ProjectionModal: React.FC<ProjectionModalProps> = ({ conceptName, onClose, onApply }) => {
    const [mode, setMode] = useState<'CONSTANT' | 'PERCENTAGE'>('CONSTANT');
    const [percentage, setPercentage] = useState<string>('0');

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
                <h3 className="text-lg font-bold text-slate-800 mb-2">Proyectar Valores</h3>
                <p className="text-sm text-slate-500 mb-4">
                    Para: <span className="font-semibold text-slate-700">{conceptName}</span>
                </p>

                <div className="space-y-3 mb-6">
                    <div 
                        onClick={() => setMode('CONSTANT')}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${mode === 'CONSTANT' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${mode === 'CONSTANT' ? 'border-blue-600' : 'border-gray-400'}`}>
                                {mode === 'CONSTANT' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                            </div>
                            <div>
                                <span className="block text-sm font-medium text-slate-800">Replicar Enero</span>
                                <span className="block text-xs text-slate-500">Copia el valor de Enero a todo el año.</span>
                            </div>
                        </div>
                    </div>

                    <div 
                        onClick={() => setMode('PERCENTAGE')}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${mode === 'PERCENTAGE' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                    >
                         <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${mode === 'PERCENTAGE' ? 'border-blue-600' : 'border-gray-400'}`}>
                                {mode === 'PERCENTAGE' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                            </div>
                            <div className="flex-1">
                                <span className="block text-sm font-medium text-slate-800">Ajuste Mensual (%)</span>
                                <span className="block text-xs text-slate-500">Aplica un % acumulativo mes a mes.</span>
                            </div>
                        </div>
                        {mode === 'PERCENTAGE' && (
                            <div className="mt-3 ml-7">
                                <label className="text-xs font-semibold text-slate-600">Porcentaje mensual:</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <input 
                                        type="number" 
                                        value={percentage}
                                        onChange={(e) => setPercentage(e.target.value)}
                                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:ring-2 focus:ring-blue-500 outline-none"
                                        autoFocus
                                    />
                                    <span className="text-sm text-slate-500">%</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                    <button 
                        onClick={() => onApply(mode, parseFloat(percentage) || 0)}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
                    >
                        Aplicar Proyección
                    </button>
                </div>
            </div>
        </div>
    );
}

const BudgetGrid: React.FC<BudgetGridProps> = ({ entries, exchangeRates, companyName, versionId, config, onUpdateEntry, onUpdateRate }) => {
  const [valueMode, setValueMode] = useState<'value' | 'units'>('value');
  const [dataMode, setDataMode] = useState<'plan' | 'real'>('plan'); // Show Plan or Real columns
  const [projectionTarget, setProjectionTarget] = useState<{cat: CategoryType, sub: string} | null>(null);

  const isConsolidated = companyName === CONSOLIDATED_ID;
  const companyConfig = config.companies.find(c => c.name === companyName);
  const currency = companyConfig?.currency || 'USD';

  // --- Helpers ---
  const getEntry = (cat: CategoryType, sub: string, monthIdx: number): BudgetEntry => {
    // Consolidated logic remains simple/blocked for now
    if (isConsolidated) {
         return {
            id: `cons-${monthIdx}`,
            month: monthIdx + 1,
            year: 2026,
            company: CONSOLIDATED_ID,
            category: cat,
            subCategory: sub,
            planValue: 0, planUnits: 0, realValue: 0, realUnits: 0,
            versionId
        };
    }

    const existing = entries.find(
      e => 
        e.company === companyName && 
        e.versionId === versionId && 
        e.month === monthIdx + 1 && 
        e.category === cat && 
        e.subCategory === sub
    );

    if (existing) return existing;

    return {
      id: generateId(),
      month: monthIdx + 1,
      year: 2026,
      company: companyName,
      category: cat,
      subCategory: sub,
      planValue: 0,
      planUnits: 0,
      realValue: 0,
      realUnits: 0,
      versionId
    };
  };

  const getRate = (monthIdx: number): ExchangeRate => {
      const existing = exchangeRates.find(r => 
        r.company === companyName && 
        r.versionId === versionId && 
        r.month === monthIdx + 1
      );
      
      if (existing) return existing;
      return {
          id: generateId(),
          company: companyName,
          month: monthIdx + 1,
          year: 2026,
          versionId,
          planRate: currency === 'USD' ? 1 : 0,
          realRate: currency === 'USD' ? 1 : 0
      }
  };

  const handleInputChange = (
    cat: CategoryType, 
    sub: string, 
    monthIdx: number,
    val: string
  ) => {
    if (isConsolidated) return;
    const numVal = parseFloat(val) || 0;
    const currentEntry = getEntry(cat, sub, monthIdx);
    
    const field = dataMode === 'plan' 
        ? (valueMode === 'value' ? 'planValue' : 'planUnits')
        : (valueMode === 'value' ? 'realValue' : 'realUnits');

    onUpdateEntry({ ...currentEntry, [field]: numVal });
  };

  const handleRateChange = (monthIdx: number, val: string) => {
      const numVal = parseFloat(val) || 0;
      const rate = getRate(monthIdx);
      const field = dataMode === 'plan' ? 'planRate' : 'realRate';
      onUpdateRate({ ...rate, [field]: numVal });
  };

  // --- Projection Logic ---
  const applyProjection = (type: 'CONSTANT' | 'PERCENTAGE', percentageVal: number) => {
      if (!projectionTarget) return;
      const { cat, sub } = projectionTarget;

      // Get Month 1 Value (Base)
      const baseEntry = getEntry(cat, sub, 0); // Jan
      const field = dataMode === 'plan' 
        ? (valueMode === 'value' ? 'planValue' : 'planUnits')
        : (valueMode === 'value' ? 'realValue' : 'realUnits');
      
      const baseValue = baseEntry[field];

      // Loop Feb (idx 1) to Dec (idx 11)
      for (let i = 1; i < 12; i++) {
          const entry = getEntry(cat, sub, i);
          let newValue = 0;

          if (type === 'CONSTANT') {
              newValue = baseValue;
          } else {
              // Percentage Logic: Previous Month * (1 + rate)
              // We need to calculate sequentially or formulaically. 
              // Formula: Base * (1 + rate)^i
              newValue = baseValue * Math.pow(1 + (percentageVal / 100), i);
          }

          // Round to 2 decimals for values, integers for units? Keep simple float for now.
          newValue = parseFloat(newValue.toFixed(2));

          onUpdateEntry({ ...entry, [field]: newValue });
      }

      setProjectionTarget(null);
  };


  // --- Renderers ---
  
  const renderGridRow = (cat: CategoryType, sub: string) => {
      let rowTotal = 0;
      
      const cells = MONTHS.map((_, idx) => {
          const entry = getEntry(cat, sub, idx);
          const val = dataMode === 'plan' 
             ? (valueMode === 'value' ? entry.planValue : entry.planUnits)
             : (valueMode === 'value' ? entry.realValue : entry.realUnits);
          
          rowTotal += val;

          return (
             <td key={idx} className="border-r border-gray-100 p-0 min-w-[100px]">
                 <input 
                    type="number"
                    disabled={isConsolidated}
                    className={`w-full h-full px-2 py-3 text-right bg-transparent outline-none focus:bg-blue-50 text-sm ${val === 0 ? 'text-gray-300' : 'text-slate-700'}`}
                    value={val === 0 ? '' : val}
                    placeholder="-"
                    onChange={(e) => handleInputChange(cat, sub, idx, e.target.value)}
                 />
             </td>
          );
      });

      return (
          <tr key={sub} className="hover:bg-gray-50 border-b border-gray-100 transition-colors group">
              {/* Sticky Column: Concept Name */}
              <td className="sticky left-0 bg-white group-hover:bg-gray-50 z-10 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  <div className="flex justify-between items-center px-4 py-3 w-[240px]">
                      <span className="text-sm font-medium text-slate-700 truncate mr-2" title={sub}>{sub}</span>
                      {!isConsolidated && (
                          <button 
                            onClick={() => setProjectionTarget({ cat, sub })}
                            className="text-gray-300 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                            title="Herramientas de Proyección"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                  <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.96l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.96 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.96l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684Z" />
                              </svg>
                          </button>
                      )}
                  </div>
              </td>
              {cells}
              <td className="bg-slate-50 border-l border-gray-200 text-right px-4 font-semibold text-sm text-slate-800 min-w-[100px]">
                  {rowTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </td>
          </tr>
      );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
      
      {/* Modal for Projections */}
      {projectionTarget && (
          <ProjectionModal 
            conceptName={projectionTarget.sub}
            onClose={() => setProjectionTarget(null)}
            onApply={applyProjection}
          />
      )}

      {/* Toolbar / Filters */}
      <div className="p-4 border-b border-gray-200 bg-white flex flex-col md:flex-row justify-between items-center gap-4">
         <div className="flex items-center gap-4">
             {isConsolidated ? (
                <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg text-sm font-medium border border-amber-200">
                    <span>🔒 Vista Consolidada (Solo Lectura)</span>
                </div>
             ) : (
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setDataMode('plan')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${dataMode === 'plan' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Planificado
                    </button>
                    <button 
                         onClick={() => setDataMode('real')}
                         className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${dataMode === 'real' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Ejecutado (Real)
                    </button>
                </div>
             )}
         </div>

         <div className="flex items-center gap-4">
             <div className="text-sm text-gray-500 font-medium hidden md:block">
                 Mostrando: <span className="text-slate-800">{dataMode === 'plan' ? 'Presupuesto' : 'Valores Reales'}</span>
             </div>
             <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                    onClick={() => setValueMode('value')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${valueMode === 'value' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    $ {currency}
                </button>
                <button 
                     onClick={() => setValueMode('units')}
                     className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${valueMode === 'units' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Unidades
                </button>
            </div>
         </div>
      </div>

      {/* Main Grid Scroll Area */}
      <div className="flex-1 overflow-auto custom-scrollbar relative">
          <table className="w-full border-collapse min-w-[1400px]">
              <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                  <tr>
                      <th className="sticky left-0 top-0 z-30 bg-slate-50 border-b border-r border-gray-200 p-4 text-left w-[240px] text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Concepto
                      </th>
                      {MONTHS.map(m => (
                          <th key={m} className="border-b border-gray-200 p-3 text-center min-w-[100px] text-xs font-bold text-gray-500 uppercase">
                              {m}
                          </th>
                      ))}
                      <th className="border-b border-l border-gray-200 p-3 text-right min-w-[100px] bg-slate-100 text-xs font-bold text-gray-600 uppercase">
                          Total
                      </th>
                  </tr>
              </thead>
              <tbody className="bg-white">
                  
                  {/* Exchange Rates Row (Macro) - Only if not consolidated and showing Values */}
                  {!isConsolidated && valueMode === 'value' && (
                       <>
                         <tr className="bg-slate-800 text-white">
                             <td className="sticky left-0 bg-slate-800 z-10 border-r border-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-wider">
                                 T. Cambio ({currency} / USD)
                             </td>
                             {MONTHS.map((_, idx) => {
                                 const r = getRate(idx);
                                 const val = dataMode === 'plan' ? r.planRate : r.realRate;
                                 return (
                                     <td key={idx} className="p-0 min-w-[100px] border-r border-slate-700">
                                         <input 
                                             type="number"
                                             className="w-full h-full px-2 py-2 text-right bg-transparent outline-none text-xs text-blue-200 focus:bg-slate-700"
                                             value={val === 0 ? '' : val}
                                             placeholder="-"
                                             onChange={(e) => handleRateChange(idx, e.target.value)}
                                         />
                                     </td>
                                 )
                             })}
                             <td className="bg-slate-900 border-l border-slate-700"></td>
                         </tr>
                       </>
                  )}

                  {/* Categories */}
                  {(['Ingresos', 'Costos Directos', 'Costos Indirectos'] as CategoryType[]).map(cat => (
                      <React.Fragment key={cat}>
                          <tr className="bg-gray-100">
                              <td className="sticky left-0 bg-gray-100 z-10 border-b border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 uppercase tracking-wider" colSpan={14}>
                                  {cat}
                              </td>
                          </tr>
                          {config.categories[cat].map(sub => renderGridRow(cat, sub))}
                          {config.categories[cat].length === 0 && (
                              <tr>
                                  <td colSpan={14} className="p-4 text-center text-sm text-gray-400 italic">
                                      Sin conceptos. Ir a configuración.
                                  </td>
                              </tr>
                          )}
                      </React.Fragment>
                  ))}
              </tbody>
          </table>
      </div>
    </div>
  );
};

export default BudgetGrid;
