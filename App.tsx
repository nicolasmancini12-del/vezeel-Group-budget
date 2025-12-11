import React, { useState, useEffect } from 'react';
import { BudgetEntry, BudgetVersion, AppConfig, ExchangeRate, CompanyDetail, CategoryType, AppUser } from './types';
import { INITIAL_VERSIONS, generateInitialEntries, generateInitialRates, DEFAULT_CONFIG, CONSOLIDATED_ID, CONSOLIDATED_NAME } from './constants';
import BudgetGrid from './components/BudgetGrid';
import Dashboard from './components/Dashboard';
import AIAnalyst from './components/AIAnalyst';
import Settings from './components/Settings';
import Login from './components/Login';
import { api, supabase } from './services/supabase';

enum View {
  DASHBOARD = 'Dashboard',
  BUDGET = 'Presupuesto',
  AI = 'Analista IA',
  SETTINGS = 'Configuración'
}

const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  // App State
  const [activeView, setActiveView] = useState<View>(View.DASHBOARD);
  const [loading, setLoading] = useState(false); // Only for data loading
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [selectedCompanyName, setSelectedCompanyName] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [versions, setVersions] = useState<BudgetVersion[]>([]);

  // 1. Initial Data Load (Only if logged in)
  useEffect(() => {
    if (currentUser) {
        loadData();
    }
  }, [currentUser]);

  const loadData = async () => {
    setLoading(true);
    if (!supabase) {
        // Fallback for demo without DB
        setEntries(generateInitialEntries());
        setExchangeRates(generateInitialRates());
        setVersions(INITIAL_VERSIONS);
        setAppConfig(DEFAULT_CONFIG);
        setSelectedCompanyName(DEFAULT_CONFIG.companies[0].name);
        setSelectedVersion(INITIAL_VERSIONS[0].id);
        setLoading(false);
        return;
    }

    const configData = await api.fetchConfig();
    const versionsData = await api.fetchVersions();

    if (configData) {
        setAppConfig(configData);
        if(configData.companies.length > 0) setSelectedCompanyName(configData.companies[0].name);
    }
    
    if (versionsData.length > 0) {
        setVersions(versionsData);
        setSelectedVersion(versionsData[0].id);
        const budgetData = await api.fetchBudgetData(versionsData[0].id);
        setEntries(budgetData.entries);
        setExchangeRates(budgetData.rates);
    } else {
        setVersions(INITIAL_VERSIONS);
        setSelectedVersion(INITIAL_VERSIONS[0].id);
    }
    setLoading(false);
  };

  // Reload data when version changes
  useEffect(() => {
      const loadVersionData = async () => {
          if (!supabase || !selectedVersion) return;
          const budgetData = await api.fetchBudgetData(selectedVersion);
          setEntries(budgetData.entries);
          setExchangeRates(budgetData.rates);
      };
      loadVersionData();
  }, [selectedVersion]);


  // --- HANDLERS ---
  const handleUpdateEntry = (updatedEntry: BudgetEntry) => {
    setEntries(prev => {
      const index = prev.findIndex(e => e.id === updatedEntry.id);
      return index >= 0 ? prev.map((e, i) => i === index ? updatedEntry : e) : [...prev, updatedEntry];
    });
    api.upsertEntry(updatedEntry);
  };

  const handleUpdateRate = (updatedRate: ExchangeRate) => {
    setExchangeRates(prev => {
        const index = prev.findIndex(r => r.id === updatedRate.id);
        return index >= 0 ? prev.map((e, i) => i === index ? updatedRate : e) : [...prev, updatedRate];
    });
    api.upsertRate(updatedRate);
  };
  
  const handleBulkUpdate = (newEntries: BudgetEntry[]) => {
      // Merge: Remove old entries for this company/version and add new ones
      // Or simply upsert one by one.
      setEntries(prev => {
          // Remove potential duplicates by ID if exists, simpler to just append unique or update
          // For simplicity: We update local state by merging
          let updated = [...prev];
          newEntries.forEach(newE => {
              const idx = updated.findIndex(existing => 
                  existing.month === newE.month && 
                  existing.category === newE.category && 
                  existing.subCategory === newE.subCategory &&
                  existing.company === newE.company
              );
              if (idx >= 0) {
                  updated[idx] = { ...updated[idx], ...newE, id: updated[idx].id }; // Keep DB ID
                  api.upsertEntry(updated[idx]);
              } else {
                  updated.push(newE);
                  api.upsertEntry(newE);
              }
          });
          return updated;
      });
  };

  // Config Handlers
  const handleRenameCompany = (oldName: string, newCompanyDetail: CompanyDetail) => {
    // ... same logic as before ...
    const updatedCompanies = appConfig.companies.map(c => c.name === oldName ? newCompanyDetail : c);
    setAppConfig({ ...appConfig, companies: updatedCompanies });
    if (selectedCompanyName === oldName) setSelectedCompanyName(newCompanyDetail.name);
    api.updateCompany(oldName, newCompanyDetail);
    loadData(); // Reload to refresh grid
  };

  const handleRenameConcept = (catType: string, oldName: string, newName: string) => {
      // ... logic ...
      api.updateCategory(catType, oldName, newName);
      loadData();
  };
  const onAddCompany = (c: CompanyDetail) => { api.addCompany(c); loadData(); };
  const onRemoveCompany = (n: string) => { api.deleteCompany(n); loadData(); };
  const onAddCategory = (t: CategoryType, n: string) => { api.addCategory(t, n); loadData(); };
  const onRemoveCategory = (t: CategoryType, n: string) => { api.deleteCategory(t, n); loadData(); };


  // --- RENDER ---
  
  if (!currentUser) {
      return <Login onLogin={setCurrentUser} />;
  }

  if (loading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
             <div className="text-center">
                 <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                 <h2 className="text-xl font-bold text-slate-700">Cargando datos...</h2>
             </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">V</div>
              <span className="font-bold text-xl tracking-tight text-slate-800">Vezeel<span className="font-light text-slate-500">Budget</span></span>
            </div>
            
            <div className="hidden md:flex gap-3 items-center">
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
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg block w-48 p-2.5"
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value)}
              >
                {versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>

              <div className="h-6 w-px bg-gray-300 mx-2"></div>
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentUser(null)}>
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                      {currentUser.name.charAt(0)}
                  </div>
                  <div className="text-xs">
                      <p className="font-bold text-slate-700">{currentUser.name}</p>
                      <p className="text-slate-500 text-[10px]">{currentUser.role}</p>
                  </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Header Filters */}
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
            onBulkUpdate={handleBulkUpdate}
          />
        )}
        {activeView === View.AI && (
          <AIAnalyst company={selectedCompanyName} entries={entries} />
        )}
        {activeView === View.SETTINGS && (
          <Settings 
            config={appConfig} 
            onUpdateConfig={() => {}} // Legacy prop
            onRenameCompany={handleRenameCompany}
            onRenameConcept={handleRenameConcept}
            onAddCompany={onAddCompany}
            onRemoveCompany={onRemoveCompany}
            onAddCategory={onAddCategory}
            onRemoveCategory={onRemoveCategory}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 pb-safe z-50">
        <div className="flex justify-around items-center h-16 max-w-7xl mx-auto">
          <button onClick={() => setActiveView(View.DASHBOARD)} className={`flex flex-col items-center ${activeView === View.DASHBOARD ? 'text-blue-600' : 'text-gray-400'}`}>
              <span className="text-xl">📊</span><span className="text-[10px]">Dash</span>
          </button>
          <button onClick={() => setActiveView(View.BUDGET)} className={`flex flex-col items-center ${activeView === View.BUDGET ? 'text-blue-600' : 'text-gray-400'}`}>
              <span className="text-xl">📝</span><span className="text-[10px]">Carga</span>
          </button>
          <button onClick={() => setActiveView(View.AI)} className={`flex flex-col items-center ${activeView === View.AI ? 'text-blue-600' : 'text-gray-400'}`}>
              <span className="text-xl">🤖</span><span className="text-[10px]">IA</span>
          </button>
          <button onClick={() => setActiveView(View.SETTINGS)} className={`flex flex-col items-center ${activeView === View.SETTINGS ? 'text-blue-600' : 'text-gray-400'}`}>
              <span className="text-xl">⚙️</span><span className="text-[10px]">Config</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;
