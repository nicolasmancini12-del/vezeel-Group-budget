
import React, { useState, useEffect } from 'react';
import { BudgetEntry, BudgetVersion, AppConfig, ExchangeRate, CompanyDetail } from './types';
import { INITIAL_VERSIONS, generateInitialEntries, generateInitialRates, DEFAULT_CONFIG, CONSOLIDATED_ID, CONSOLIDATED_NAME } from './constants';
import BudgetGrid from './components/BudgetGrid';
import Dashboard from './components/Dashboard';
import AIAnalyst from './components/AIAnalyst';
import Settings from './components/Settings';

enum View {
  DASHBOARD = 'Dashboard',
  BUDGET = 'Presupuesto',
  AI = 'Analista IA',
  SETTINGS = 'Configuración'
}

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>(View.DASHBOARD);
  
  // Configuration State
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  
  // Selection State
  const [selectedCompanyName, setSelectedCompanyName] = useState<string>(DEFAULT_CONFIG.companies[0].name);
  const [selectedVersion, setSelectedVersion] = useState<string>('v1');
  
  // App Data State
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [versions, setVersions] = useState<BudgetVersion[]>(INITIAL_VERSIONS);

  useEffect(() => {
    setEntries(generateInitialEntries());
    setExchangeRates(generateInitialRates());
  }, []);

  const handleUpdateEntry = (updatedEntry: BudgetEntry) => {
    setEntries(prev => {
      const index = prev.findIndex(e => e.id === updatedEntry.id);
      if (index >= 0) {
        const newEntries = [...prev];
        newEntries[index] = updatedEntry;
        return newEntries;
      } else {
        return [...prev, updatedEntry];
      }
    });
  };

  const handleUpdateRate = (updatedRate: ExchangeRate) => {
    setExchangeRates(prev => {
      const index = prev.findIndex(r => r.id === updatedRate.id);
      if (index >= 0) {
        const newRates = [...prev];
        newRates[index] = updatedRate;
        return newRates;
      } else {
        return [...prev, updatedRate];
      }
    });
  };

  // --- ABM CASCADE UPDATES ---
  
  // When a company is renamed in Settings, we must update all entries and rates
  const handleRenameCompany = (oldName: string, newCompanyDetail: CompanyDetail) => {
    // 1. Update Config
    const updatedCompanies = appConfig.companies.map(c => 
      c.name === oldName ? newCompanyDetail : c
    );
    setAppConfig({ ...appConfig, companies: updatedCompanies });

    // 2. Update Entries
    setEntries(prev => prev.map(e => e.company === oldName ? { ...e, company: newCompanyDetail.name } : e));

    // 3. Update Rates
    setExchangeRates(prev => prev.map(r => r.company === oldName ? { ...r, company: newCompanyDetail.name } : r));

    // 4. Update Selection if needed
    if (selectedCompanyName === oldName) {
      setSelectedCompanyName(newCompanyDetail.name);
    }
  };

  // When a concept is renamed
  const handleRenameConcept = (catType: string, oldName: string, newName: string) => {
    // 1. Update Config
    const updatedCategories = {
      ...appConfig.categories,
      [catType]: appConfig.categories[catType as keyof typeof appConfig.categories].map(c => c === oldName ? newName : c)
    };
    setAppConfig({ ...appConfig, categories: updatedCategories });

    // 2. Update Entries
    setEntries(prev => prev.map(e => 
      (e.category === catType && e.subCategory === oldName) 
        ? { ...e, subCategory: newName } 
        : e
    ));
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">V</div>
              <span className="font-bold text-xl tracking-tight text-slate-800">Vezeel<span className="font-light text-slate-500">Budget</span></span>
            </div>
            
            {/* Context Selectors (Desktop) */}
            <div className="hidden md:flex gap-3">
              <select 
                className={`text-sm rounded-lg border block w-56 p-2.5 ${selectedCompanyName === CONSOLIDATED_ID ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                value={selectedCompanyName}
                onChange={(e) => setSelectedCompanyName(e.target.value)}
              >
                <option value={CONSOLIDATED_ID} className="font-bold">{CONSOLIDATED_NAME}</option>
                <optgroup label="Empresas">
                  {appConfig.companies.map(c => <option key={c.id} value={c.name}>{c.name} ({c.currency})</option>)}
                </optgroup>
              </select>
              
              <select 
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-48 p-2.5"
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value)}
              >
                {versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Filters */}
      <div className="md:hidden p-4 bg-white border-b border-gray-200 space-y-2">
         <select 
            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg block w-full p-2"
            value={selectedCompanyName}
            onChange={(e) => setSelectedCompanyName(e.target.value)}
          >
            <option value={CONSOLIDATED_ID} className="font-bold">{CONSOLIDATED_NAME}</option>
            {appConfig.companies.map(c => <option key={c.id} value={c.name}>{c.name} ({c.currency})</option>)}
          </select>
          <select 
            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg block w-full p-2"
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
          >
            {versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 overflow-hidden h-full">
        {activeView === View.DASHBOARD && (
          <Dashboard 
            entries={entries} 
            exchangeRates={exchangeRates}
            companyName={selectedCompanyName} 
            versionId={selectedVersion} 
            companiesConfig={appConfig.companies}
          />
        )}
        {activeView === View.BUDGET && (
          <BudgetGrid 
            entries={entries} 
            exchangeRates={exchangeRates}
            companyName={selectedCompanyName} 
            versionId={selectedVersion} 
            config={appConfig} 
            onUpdateEntry={handleUpdateEntry} 
            onUpdateRate={handleUpdateRate}
          />
        )}
        {activeView === View.AI && (
          <AIAnalyst company={selectedCompanyName} entries={entries} />
        )}
        {activeView === View.SETTINGS && (
          <Settings 
            config={appConfig} 
            onUpdateConfig={setAppConfig} 
            onRenameCompany={handleRenameCompany}
            onRenameConcept={handleRenameConcept}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 pb-safe z-50">
        <div className="flex justify-around items-center h-16 max-w-7xl mx-auto">
          <button 
            onClick={() => setActiveView(View.DASHBOARD)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeView === View.DASHBOARD ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
            <span className="text-xs font-medium">Dashboard</span>
          </button>
          
          <button 
            onClick={() => setActiveView(View.BUDGET)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeView === View.BUDGET ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M19.125 14.625c.621 0 1.125.504 1.125 1.125V16.5c0 .621-.504 1.125-1.125 1.125" />
            </svg>
            <span className="text-xs font-medium">Carga</span>
          </button>

          <button 
            onClick={() => setActiveView(View.AI)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeView === View.AI ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
            </svg>
            <span className="text-xs font-medium">Analista IA</span>
          </button>

          <button 
            onClick={() => setActiveView(View.SETTINGS)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeView === View.SETTINGS ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            <span className="text-xs font-medium">Config</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;
