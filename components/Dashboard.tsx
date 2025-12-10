
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart } from 'recharts';
import { BudgetEntry, CategoryType, ExchangeRate, CompanyDetail } from '../types';
import { MONTHS, CONSOLIDATED_ID } from '../constants';

interface DashboardProps {
  entries: BudgetEntry[];
  exchangeRates: ExchangeRate[];
  companyName: string;
  versionId: string;
  companiesConfig: CompanyDetail[];
}

const Dashboard: React.FC<DashboardProps> = ({ entries, exchangeRates, companyName, versionId, companiesConfig }) => {
  const [showInUSD, setShowInUSD] = useState(true);

  const isConsolidated = companyName === CONSOLIDATED_ID;
  const currentCompany = companiesConfig.find(c => c.name === companyName);
  const isUSDCompany = currentCompany?.currency === 'USD';

  // Force USD display if Consolidated
  const displayInUSD = isConsolidated || showInUSD;
  const currencyLabel = displayInUSD ? 'USD' : (currentCompany?.currency || '');

  const data = useMemo(() => {
    return MONTHS.map((monthName, idx) => {
      const monthIndex = idx + 1;
      
      // Determine relevant entries
      const relevantEntries = entries.filter(e => 
        (isConsolidated ? true : e.company === companyName) && 
        e.versionId === versionId && 
        e.month === monthIndex
      );

      let incomePlan = 0;
      let incomeReal = 0;
      let expensePlan = 0;
      let expenseReal = 0;

      relevantEntries.forEach(entry => {
          let pVal = entry.planValue;
          let rVal = entry.realValue;

          // CURRENCY CONVERSION LOGIC
          if (displayInUSD) {
              const compConfig = companiesConfig.find(c => c.name === entry.company);
              if (compConfig && compConfig.currency !== 'USD') {
                  // Find rate
                  const rate = exchangeRates.find(r => 
                    r.company === entry.company && 
                    r.versionId === versionId && 
                    r.month === monthIndex
                  );

                  // Calculate USD = Local / Rate
                  // Default rate to 1 to avoid division by zero, but technically if no rate is set, value is undefined/error.
                  // For UI safety we use 1 but maybe should log warning.
                  const pRate = rate?.planRate && rate.planRate > 0 ? rate.planRate : 1;
                  const rRate = rate?.realRate && rate.realRate > 0 ? rate.realRate : 1;

                  pVal = pVal / pRate;
                  rVal = rVal / rRate;
              }
          }

          if (entry.category === 'Ingresos') {
              incomePlan += pVal;
              incomeReal += rVal;
          } else {
              expensePlan += pVal;
              expenseReal += rVal;
          }
      });

      const netPlan = incomePlan - expensePlan;
      const netReal = incomeReal - expenseReal;

      return {
        name: monthName.substring(0, 3),
        incomePlan,
        incomeReal,
        expensePlan,
        expenseReal,
        netPlan,
        netReal
      };
    });
  }, [entries, exchangeRates, companyName, versionId, isConsolidated, displayInUSD, companiesConfig]);

  // KPIs Accumulados
  const totals = useMemo(() => {
     return data.reduce((acc, curr) => ({
         incomePlan: acc.incomePlan + curr.incomePlan,
         incomeReal: acc.incomeReal + curr.incomeReal,
         expensePlan: acc.expensePlan + curr.expensePlan,
         expenseReal: acc.expenseReal + curr.expenseReal
     }), { incomePlan: 0, incomeReal: 0, expensePlan: 0, expenseReal: 0 });
  }, [data]);

  const compliance = totals.incomePlan > 0 ? (totals.incomeReal / totals.incomePlan) * 100 : 0;
  const netReal = totals.incomeReal - totals.expenseReal;
  const netPlan = totals.incomePlan - totals.expensePlan;

  const formatCurrency = (val: number) => {
      // Short format: 1.2k, 1.5M
      if (Math.abs(val) >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
      if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(1)}k`;
      return `$${val.toFixed(0)}`;
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header Info */}
      <div className="flex justify-between items-start">
        {isConsolidated ? (
            <div className="bg-indigo-600 text-white px-4 py-3 rounded-xl shadow-md flex items-center gap-3 flex-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
            </svg>
            <div>
                <p className="font-bold text-sm">Vista Consolidada del Grupo (USD)</p>
                <p className="text-xs text-indigo-100">Sumatoria convertida de todas las empresas.</p>
            </div>
            </div>
        ) : (
            <div className="bg-white border border-gray-200 text-gray-800 px-4 py-3 rounded-xl shadow-sm flex items-center gap-3 flex-1">
                <div className="bg-slate-100 p-2 rounded-lg">
                    <span className="text-xl">📊</span>
                </div>
                <div>
                    <p className="font-bold text-sm">Dashboard de {companyName}</p>
                    <p className="text-xs text-gray-500">Moneda base: {currentCompany?.currency}</p>
                </div>
            </div>
        )}

        {/* Currency Toggle (Only for individual companies that are NOT USD) */}
        {!isConsolidated && !isUSDCompany && (
            <div className="ml-4 bg-gray-200 p-1 rounded-lg flex text-xs font-semibold shrink-0">
                <button 
                    onClick={() => setShowInUSD(false)}
                    className={`px-3 py-2 rounded-md transition-all ${!showInUSD ? 'bg-white shadow text-slate-800' : 'text-gray-500'}`}
                >
                    {currentCompany?.currency}
                </button>
                <button 
                    onClick={() => setShowInUSD(true)}
                    className={`px-3 py-2 rounded-md transition-all ${showInUSD ? 'bg-white shadow text-slate-800' : 'text-gray-500'}`}
                >
                    USD $
                </button>
            </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Cumplimiento Ventas</p>
          <div className="flex items-end justify-between mt-2">
            <h2 className="text-2xl font-bold text-slate-800">{compliance.toFixed(1)}%</h2>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${compliance >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              YTD
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mt-3">
             <div className={`h-2 rounded-full ${compliance >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(compliance, 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Margen Real (YTD)</p>
          <div className="flex items-end justify-between mt-2">
            <h2 className="text-2xl font-bold text-slate-800">{formatCurrency(netReal)} <span className="text-sm font-normal text-gray-400">{currencyLabel}</span></h2>
            <span className="text-xs text-gray-400">Neto</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">Planificado: {formatCurrency(netPlan)}</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Desvío Gastos</p>
          <div className="flex items-end justify-between mt-2">
            <h2 className={`text-2xl font-bold ${totals.expenseReal > totals.expensePlan ? 'text-rose-600' : 'text-emerald-600'}`}>
               {totals.expensePlan > 0 ? (((totals.expenseReal - totals.expensePlan) / totals.expensePlan) * 100).toFixed(1) : 0}%
            </h2>
             <span className="text-xs text-gray-400">vs Plan</span>
          </div>
           <p className="text-xs text-gray-500 mt-2">Gastado: {formatCurrency(totals.expenseReal)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Ingresos: Plan vs Real ({currencyLabel})</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={formatCurrency} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                formatter={(val: number) => [formatCurrency(val), '']}
              />
              <Legend />
              <Bar dataKey="incomePlan" name="Planificado" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="incomeReal" name="Ejecutado" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Evolución de Resultados ({currencyLabel})</h3>
        <div className="h-64">
           <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={formatCurrency} />
              <Tooltip 
                 contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                 formatter={(val: number) => [formatCurrency(val), '']}
              />
              <Legend />
              <Bar dataKey="netPlan" name="Neto Plan" fill="#e2e8f0" barSize={20} radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="netReal" name="Neto Real" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
