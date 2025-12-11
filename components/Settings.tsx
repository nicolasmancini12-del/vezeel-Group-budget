
import React, { useState } from 'react';
import { AppConfig, CategoryType, CATEGORY_TYPES, CompanyDetail } from '../types';
import { generateId } from '../constants';

interface SettingsProps {
  config: AppConfig;
  onUpdateConfig: (newConfig: AppConfig) => void;
  onRenameCompany: (oldName: string, newCompanyDetail: CompanyDetail) => void;
  onRenameConcept: (catType: string, oldName: string, newName: string) => void;
  // DB Props
  onAddCompany?: (company: CompanyDetail) => void;
  onRemoveCompany?: (name: string) => void;
  onAddCategory?: (type: CategoryType, name: string) => void;
  onRemoveCategory?: (type: CategoryType, name: string) => void;
}

const Settings: React.FC<SettingsProps> = ({ 
    config, 
    onUpdateConfig, 
    onRenameCompany, 
    onRenameConcept,
    onAddCompany,
    onRemoveCompany,
    onAddCategory,
    onRemoveCategory
}) => {
  // New Item State
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCurrency, setNewCompanyCurrency] = useState('USD');
  const [newConcept, setNewConcept] = useState('');
  const [selectedCategoryType, setSelectedCategoryType] = useState<CategoryType>('Ingresos');

  // Edit State
  const [editingCompany, setEditingCompany] = useState<string | null>(null);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editCompanyCurrency, setEditCompanyCurrency] = useState('USD');

  const [editingConcept, setEditingConcept] = useState<string | null>(null);
  const [editConceptName, setEditConceptName] = useState('');

  // --- Companies Logic ---
  const addCompany = () => {
    if (newCompanyName.trim() && !config.companies.some(c => c.name === newCompanyName.trim())) {
      const newCompany: CompanyDetail = {
          id: generateId(),
          name: newCompanyName.trim(),
          currency: newCompanyCurrency
      };
      
      if (onAddCompany) {
          onAddCompany(newCompany);
      } else {
          // Fallback legacy
          onUpdateConfig({
            ...config,
            companies: [...config.companies, newCompany]
          });
      }

      setNewCompanyName('');
      setNewCompanyCurrency('USD');
    }
  };

  const removeCompany = (companyName: string) => {
    if (window.confirm(`¿Seguro que deseas eliminar la empresa "${companyName}" y todos sus datos?`)) {
      if (onRemoveCompany) {
          onRemoveCompany(companyName);
      } else {
          onUpdateConfig({
            ...config,
            companies: config.companies.filter(c => c.name !== companyName)
          });
      }
    }
  };

  const startEditCompany = (company: CompanyDetail) => {
    setEditingCompany(company.name);
    setEditCompanyName(company.name);
    setEditCompanyCurrency(company.currency);
  };

  const saveEditCompany = () => {
    if (editingCompany && editCompanyName.trim()) {
       const newDetail: CompanyDetail = {
           id: config.companies.find(c => c.name === editingCompany)?.id || generateId(),
           name: editCompanyName.trim(),
           currency: editCompanyCurrency
       };
       onRenameCompany(editingCompany, newDetail);
       setEditingCompany(null);
    }
  };

  // --- Concepts Logic ---
  const addConcept = () => {
    if (newConcept.trim()) {
      const currentList = config.categories[selectedCategoryType];
      if (!currentList.includes(newConcept.trim())) {
        if (onAddCategory) {
            onAddCategory(selectedCategoryType, newConcept.trim());
        } else {
            onUpdateConfig({
            ...config,
            categories: {
                ...config.categories,
                [selectedCategoryType]: [...currentList, newConcept.trim()]
            }
            });
        }
        setNewConcept('');
      }
    }
  };

  const removeConcept = (catType: CategoryType, concept: string) => {
    if (window.confirm(`¿Eliminar concepto "${concept}" de ${catType}?`)) {
      if (onRemoveCategory) {
          onRemoveCategory(catType, concept);
      } else {
          onUpdateConfig({
            ...config,
            categories: {
                ...config.categories,
                [catType]: config.categories[catType].filter(c => c !== concept)
            }
          });
      }
    }
  };

  const startEditConcept = (concept: string) => {
      setEditingConcept(concept);
      setEditConceptName(concept);
  };

  const saveEditConcept = () => {
      if (editingConcept && editConceptName.trim()) {
          onRenameConcept(selectedCategoryType, editingConcept, editConceptName.trim());
          setEditingConcept(null);
      }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden pb-20">
      <div className="p-6 border-b border-gray-100 bg-slate-50">
        <h2 className="text-xl font-bold text-slate-800">Configuración General (ABM)</h2>
        <p className="text-sm text-slate-500">Gestione empresas, monedas y conceptos presupuestarios.</p>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Section: Companies */}
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 p-1 rounded">🏢</span> Empresas
          </h3>
          
          {/* Add Company */}
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="Nueva empresa..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <select
               value={newCompanyCurrency}
               onChange={(e) => setNewCompanyCurrency(e.target.value)}
               className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
                <option value="MXN">MXN</option>
                <option value="EUR">EUR</option>
                <option value="BRL">BRL</option>
            </select>
            <button 
              onClick={addCompany}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Agregar
            </button>
          </div>

          <ul className="space-y-2">
            {config.companies.map(company => (
              <li key={company.id} className="flex flex-col md:flex-row justify-between md:items-center bg-gray-50 p-3 rounded-lg border border-gray-100 gap-2">
                {editingCompany === company.name ? (
                    <div className="flex gap-2 flex-1">
                        <input 
                            value={editCompanyName}
                            onChange={(e) => setEditCompanyName(e.target.value)}
                            className="flex-1 border border-blue-300 rounded px-2 py-1 text-sm"
                        />
                        <select
                            value={editCompanyCurrency}
                            onChange={(e) => setEditCompanyCurrency(e.target.value)}
                            className="border border-blue-300 rounded px-2 py-1 text-sm"
                        >
                            <option value="USD">USD</option>
                            <option value="ARS">ARS</option>
                            <option value="MXN">MXN</option>
                            <option value="EUR">EUR</option>
                            <option value="BRL">BRL</option>
                        </select>
                        <button onClick={saveEditCompany} className="text-green-600 hover:text-green-800 text-sm font-medium">Guardar</button>
                        <button onClick={() => setEditingCompany(null)} className="text-gray-400 hover:text-gray-600 text-sm">X</button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-700 font-medium">{company.name}</span>
                            <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded">{company.currency}</span>
                        </div>
                        <div className="flex gap-1">
                             <button 
                                onClick={() => startEditCompany(company)}
                                className="text-blue-400 hover:text-blue-600 p-1"
                                title="Editar"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                </svg>
                            </button>
                            <button 
                                onClick={() => removeCompany(company.name)}
                                className="text-red-400 hover:text-red-600 p-1"
                                title="Eliminar"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                            </button>
                        </div>
                    </>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Section: Concepts */}
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-700 p-1 rounded">🏷️</span> Conceptos y Servicios
          </h3>

          <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
             {CATEGORY_TYPES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategoryType(cat)}
                  className={`text-xs px-3 py-1 rounded-full whitespace-nowrap transition-colors ${selectedCategoryType === cat ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {cat}
                </button>
             ))}
          </div>
          
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={newConcept}
              onChange={(e) => setNewConcept(e.target.value)}
              placeholder={`Nuevo concepto en ${selectedCategoryType}...`}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <button 
              onClick={addConcept}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700"
            >
              Agregar
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto pr-2 custom-scrollbar">
            <ul className="space-y-2">
                {config.categories[selectedCategoryType].map(concept => (
                <li key={concept} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                    {editingConcept === concept ? (
                        <div className="flex gap-2 flex-1">
                             <input 
                                value={editConceptName}
                                onChange={(e) => setEditConceptName(e.target.value)}
                                className="flex-1 border border-emerald-300 rounded px-2 py-1 text-sm"
                            />
                            <button onClick={saveEditConcept} className="text-green-600 hover:text-green-800 text-sm font-medium">OK</button>
                            <button onClick={() => setEditingConcept(null)} className="text-gray-400 hover:text-gray-600 text-sm">X</button>
                        </div>
                    ) : (
                        <>
                            <span className="text-slate-700 font-medium text-sm">{concept}</span>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => startEditConcept(concept)}
                                    className="text-blue-400 hover:text-blue-600 p-1"
                                    title="Editar"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                    </svg>
                                </button>
                                <button 
                                    onClick={() => removeConcept(selectedCategoryType, concept)}
                                    className="text-red-400 hover:text-red-600 p-1"
                                    title="Eliminar"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </>
                    )}
                </li>
                ))}
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Settings;
