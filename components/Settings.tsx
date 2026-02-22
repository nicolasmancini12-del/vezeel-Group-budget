import React, { useState, useEffect, useRef } from 'react';
import { AppConfig, CategoryType, CATEGORY_TYPES, CompanyDetail, AppUser, BudgetVersion, CategoryAssignment } from '../types';
import { generateId } from '../constants';
import { authService } from '../services/authService';
import { api } from '../services/supabase';
import { Pencil, Trash2, X, Download, Upload, Users } from 'lucide-react';
import { excelService } from '../services/excelService';

interface SettingsProps {
  config: AppConfig;
  onUpdateConfig: (newConfig: AppConfig) => void;
  onRenameCompany: (oldName: string, newCompanyDetail: CompanyDetail) => Promise<void> | void;
  onRenameConcept: (catType: string, oldName: string, newName: string) => Promise<void> | void;
  onAddCompany?: (company: CompanyDetail) => Promise<void> | void;
  onRemoveCompany?: (name: string) => Promise<void> | void;
  onAddCategory?: (type: CategoryType, name: string) => Promise<void> | void;
  onRemoveCategory?: (type: CategoryType, name: string) => Promise<void> | void;
  onVersionsUpdated?: () => Promise<void> | void; 
}

const Settings: React.FC<SettingsProps> = ({ 
    config, onUpdateConfig, onRenameCompany, onRenameConcept,
    onAddCompany, onRemoveCompany, onAddCategory, onRemoveCategory,
    onVersionsUpdated
}) => {
  const [tab, setTab] = useState<'GENERAL' | 'VERSIONS' | 'USERS'>('GENERAL');
  const configFileInputRef = useRef<HTMLInputElement>(null);
  
  // --- GENERAL STATE ---
  const [editingCompanyOldName, setEditingCompanyOldName] = useState<string | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCurrency, setNewCompanyCurrency] = useState('USD');
  const [isSubmittingCompany, setIsSubmittingCompany] = useState(false);
  
  const [editingConceptOldName, setEditingConceptOldName] = useState<string | null>(null);
  const [newConcept, setNewConcept] = useState('');
  const [newClient, setNewClient] = useState('');
  const [selectedCategoryType, setSelectedCategoryType] = useState<CategoryType>('Ingresos');
  const [selectedCompaniesForConcept, setSelectedCompaniesForConcept] = useState<string[]>([]);
  const [isSubmittingConcept, setIsSubmittingConcept] = useState(false);

  // --- USERS STATE ---
  const [users, setUsers] = useState<AppUser[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<'ADMIN' | 'USER'>('USER');

  // --- VERSIONS STATE ---
  const [versions, setVersions] = useState<BudgetVersion[]>([]);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionDesc, setNewVersionDesc] = useState('');
  const [cloneSourceId, setCloneSourceId] = useState('');

  useEffect(() => {
    if (tab === 'USERS') loadUsers();
    if (tab === 'VERSIONS') loadVersions();
  }, [tab]);

  const loadUsers = async () => {
      const data = await authService.getUsers();
      setUsers(data);
  };

  const loadVersions = async () => {
      const data = await api.fetchVersions();
      setVersions(data);
      if(data.length > 0 && !cloneSourceId) setCloneSourceId(data[0].id);
  };

  const handleExportConfig = () => {
      excelService.exportConfigMatrix(config.assignments);
  };

  const handleImportConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          if (!confirm("Se reemplazarán todas las asignaciones actuales por las del archivo. ¿Continuar?")) return;
          try {
              const newAssignments = await excelService.importConfigMatrix(e.target.files[0]);
              if (!newAssignments || newAssignments.length === 0) {
                  alert("No se encontraron datos válidos en el archivo.");
                  return;
              }
              await api.bulkUpdateAssignments(newAssignments);
              alert("¡Configuración importada con éxito! La aplicación se reiniciará para reflejar los cambios.");
              window.location.reload();
          } catch (err: any) {
              console.error("Import error:", err);
              alert("Error crítico al importar: " + (err.message || "Error desconocido en la base de datos."));
          }
      }
  };

  // --- REST OF HANDLERS ---
  const handleEditCompany = (c: CompanyDetail) => {
      setEditingCompanyOldName(c.name);
      setNewCompanyName(c.name);
      setNewCompanyCurrency(c.currency);
  };

  const handleCancelEditCompany = () => {
      setEditingCompanyOldName(null);
      setNewCompanyName('');
      setNewCompanyCurrency('USD');
      setIsSubmittingCompany(false);
  };

  const saveCompany = async () => {
      if (!newCompanyName.trim()) return;
      setIsSubmittingCompany(true);
      try {
          if (editingCompanyOldName) {
              const updatedCompany: CompanyDetail = { 
                  id: generateId(), 
                  name: newCompanyName.trim(), 
                  currency: newCompanyCurrency 
              };
              await onRenameCompany(editingCompanyOldName, updatedCompany);
              handleCancelEditCompany();
          } else {
              const newCompany: CompanyDetail = { 
                  id: generateId(), 
                  name: newCompanyName.trim(), 
                  currency: newCompanyCurrency 
              };
              if (onAddCompany) await onAddCompany(newCompany);
              setNewCompanyName('');
          }
      } catch (error: any) {
          alert("Error al guardar empresa");
      } finally {
          setIsSubmittingCompany(false);
      }
  };

  const handleEditConcept = (assignment: CategoryAssignment) => {
      setEditingConceptOldName(assignment.categoryName);
      setNewConcept(assignment.categoryName);
      setNewClient(assignment.clientName || '');
      setSelectedCompaniesForConcept([assignment.companyName]);
  };

  const saveConcept = async () => {
      if (!newConcept.trim()) return;
      setIsSubmittingConcept(true);
      const conceptName = newConcept.trim();
      const clientName = newClient.trim();

      try {
        if (onAddCategory) {
            await onAddCategory(selectedCategoryType, conceptName);
            await api.addIndividualAssignment(selectedCategoryType, conceptName, clientName, selectedCompaniesForConcept);
            alert("Concepto guardado con éxito.");
            setNewConcept('');
            setNewClient('');
            window.location.reload();
        }
      } catch (error: any) {
          alert("Error al guardar concepto: " + error.message);
      } finally {
          setIsSubmittingConcept(false);
      }
  };

  const saveVersion = async () => {
      if (!newVersionName.trim()) return;
      try {
          if (editingVersionId) {
              await api.updateVersion(editingVersionId, newVersionName, newVersionDesc);
              handleCancelEditVersion();
          } else {
              if (cloneSourceId) {
                if(!confirm(`¿Clonar datos de la versión seleccionada a "${newVersionName}"?`)) return;
                await api.cloneVersion(cloneSourceId, newVersionName, newVersionDesc);
              } else {
                await api.createVersion(newVersionName, newVersionDesc);
              }
              setNewVersionName('');
              setNewVersionDesc('');
          }
          loadVersions();
          if(onVersionsUpdated) await onVersionsUpdated();
      } catch (error: any) { alert("Error: " + error.message); }
  };

  const handleCancelEditVersion = () => {
      setEditingVersionId(null);
      setNewVersionName('');
      setNewVersionDesc('');
  };

  const saveUser = async () => {
      if (!newUserName || !newUserEmail) return;
      try {
          if (editingUserId) {
              await authService.updateUser({ id: editingUserId, name: newUserName, email: newUserEmail, role: newUserRole, password: newUserPass });
              handleCancelEditUser();
          } else {
              if (!newUserPass) return alert('La contraseña es obligatoria para nuevos usuarios');
              await authService.createUser({ email: newUserEmail, password: newUserPass, name: newUserName, role: newUserRole });
              setNewUserEmail(''); setNewUserPass(''); setNewUserName('');
          }
          loadUsers();
      } catch (error: any) { alert("Error: " + error.message); }
  };

  const handleCancelEditUser = () => {
    setEditingUserId(null);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserRole('USER');
    setNewUserPass('');
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col">
       <div className="flex border-b border-gray-200 bg-slate-50 overflow-x-auto">
           <button onClick={() => setTab('GENERAL')} className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${tab === 'GENERAL' ? 'bg-white border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>🏢 Empresas y Conceptos</button>
           <button onClick={() => setTab('VERSIONS')} className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${tab === 'VERSIONS' ? 'bg-white border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>📅 Versiones</button>
           <button onClick={() => setTab('USERS')} className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${tab === 'USERS' ? 'bg-white border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>👥 Usuarios</button>
       </div>

       <div className="p-6 overflow-y-auto flex-1 pb-20">
           {tab === 'GENERAL' && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div>
                       <h3 className="font-bold text-slate-700 mb-4">Empresas</h3>
                       <div className={`p-3 rounded-lg border mb-4 ${editingCompanyOldName ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-gray-100'}`}>
                           <p className="text-xs font-bold text-gray-500 mb-2">{editingCompanyOldName ? '✏️ Editando Empresa' : '➕ Nueva Empresa'}</p>
                           <div className="flex gap-2">
                               <input value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} placeholder="Nombre..." className="border p-2 rounded flex-1 text-sm" />
                               <select value={newCompanyCurrency} onChange={e => setNewCompanyCurrency(e.target.value)} className="border p-2 rounded text-sm bg-white"><option>USD</option><option>ARS</option><option>MXN</option></select>
                           </div>
                           <div className="flex justify-end gap-2 mt-2">
                               {editingCompanyOldName && <button onClick={handleCancelEditCompany} className="text-gray-500 px-3 py-1 rounded text-sm hover:bg-gray-200">Cancelar</button>}
                               <button onClick={saveCompany} disabled={isSubmittingCompany} className={`${editingCompanyOldName ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-3 py-1 rounded text-sm shadow-sm transition-colors`}>{isSubmittingCompany ? 'Guardando...' : 'Guardar'}</button>
                           </div>
                       </div>
                       <ul className="space-y-2">
                           {config.companies.map(c => (
                               <li key={c.id} className="flex justify-between items-center bg-white p-2 rounded border hover:shadow-sm">
                                   <span className="text-sm">{c.name} <span className="text-gray-400">({c.currency})</span></span>
                                   <div className="flex gap-1">
                                       <button onClick={() => handleEditCompany(c)} className="text-blue-500 p-1 hover:bg-blue-50 rounded"><Pencil size={14} /></button>
                                       <button onClick={() => onRemoveCompany && onRemoveCompany(c.name)} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                                   </div>
                               </li>
                           ))}
                       </ul>
                   </div>
                   
                   <div>
                       <div className="flex justify-between items-center mb-4">
                           <h3 className="font-bold text-slate-700">Conceptos y Clientes</h3>
                           <div className="flex gap-2">
                               <input type="file" ref={configFileInputRef} onChange={handleImportConfig} className="hidden" accept=".xlsx" />
                               <button onClick={() => configFileInputRef.current?.click()} className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 hover:bg-indigo-100"><Upload size={12}/> Importar ABM</button>
                               <button onClick={handleExportConfig} className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 hover:bg-emerald-100"><Download size={12}/> Exportar Matriz</button>
                           </div>
                       </div>
                       <div className="flex gap-2 mb-2">
                           {CATEGORY_TYPES.map(t => (
                               <button key={t} onClick={() => setSelectedCategoryType(t)} className={`text-xs px-2 py-1 rounded ${selectedCategoryType===t ? 'bg-slate-800 text-white' : 'bg-gray-100'}`}>{t}</button>
                           ))}
                       </div>

                       <div className="bg-slate-50 p-3 rounded-lg border border-gray-100 mb-4">
                           <p className="text-xs font-bold text-gray-500 mb-2">➕ Agregar Nuevo Concepto-Cliente</p>
                           <div className="grid grid-cols-2 gap-2 mb-2">
                               <input value={newConcept} onChange={e => setNewConcept(e.target.value)} placeholder="Concepto (ej: Licencias)" className="border p-2 rounded text-sm bg-white" />
                               <input value={newClient} onChange={e => setNewClient(e.target.value)} placeholder="Cliente (ej: Microsoft)" className="border p-2 rounded text-sm bg-white" />
                           </div>
                           <div className="mb-2">
                               <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Empresas Asignadas:</p>
                               <div className="flex flex-wrap gap-1">
                                   {config.companies.map(c => (
                                       <button key={c.id} onClick={() => setSelectedCompaniesForConcept(prev => prev.includes(c.name) ? prev.filter(x=>x!==c.name) : [...prev, c.name])} className={`text-[10px] px-2 py-0.5 rounded border ${selectedCompaniesForConcept.includes(c.name) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>{c.name}</button>
                                   ))}
                               </div>
                           </div>
                           <button onClick={saveConcept} disabled={isSubmittingConcept} className="w-full bg-slate-800 text-white text-sm py-2 rounded hover:bg-slate-900 disabled:opacity-50">Guardar Asignación</button>
                       </div>
                       
                       <div className="max-h-80 overflow-y-auto space-y-1">
                           {config.assignments.filter(a => a.categoryType === selectedCategoryType).map((a, i) => (
                               <div key={i} className="flex justify-between items-center p-2 border rounded text-sm bg-white hover:bg-slate-50">
                                   <div>
                                       <span className="font-medium">{a.categoryName}</span>
                                       {a.clientName && <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">{a.clientName}</span>}
                                       <div className="text-[10px] text-gray-400">{a.companyName}</div>
                                   </div>
                                   <button onClick={() => onRemoveCategory && onRemoveCategory(a.categoryType as CategoryType, a.categoryName)} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                               </div>
                           ))}
                       </div>
                   </div>
               </div>
           )}

           {tab === 'VERSIONS' && (
               <div className="space-y-6">
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                       <h3 className="font-bold text-slate-700 mb-4">{editingVersionId ? '✏️ Editar Versión' : '➕ Crear Nueva Versión'}</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <input value={newVersionName} onChange={e => setNewVersionName(e.target.value)} placeholder="Nombre de versión (ej: Base 2026)" className="border p-2 rounded text-sm bg-white" />
                           <input value={newVersionDesc} onChange={e => setNewVersionDesc(e.target.value)} placeholder="Descripción..." className="border p-2 rounded text-sm bg-white" />
                       </div>
                       {!editingVersionId && (
                           <div className="mt-4">
                               <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Clonar datos de:</label>
                               <select value={cloneSourceId} onChange={e => setCloneSourceId(e.target.value)} className="w-full border p-2 rounded text-sm bg-white">
                                   {versions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                               </select>
                           </div>
                       )}
                       <div className="flex justify-end gap-2 mt-4">
                           {editingVersionId && <button onClick={handleCancelEditVersion} className="px-4 py-2 text-sm text-gray-500">Cancelar</button>}
                           <button onClick={saveVersion} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm">{editingVersionId ? 'Actualizar' : 'Crear Versión'}</button>
                       </div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {versions.map(v => (
                           <div key={v.id} className={`p-4 rounded-xl border ${v.isActive ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 bg-white'}`}>
                               <div className="flex justify-between items-start mb-2">
                                   <div>
                                       <p className="font-bold text-slate-800">{v.name}</p>
                                       <p className="text-xs text-slate-500">{v.description}</p>
                                   </div>
                                   <div className="flex gap-1">
                                       <button onClick={() => { setEditingVersionId(v.id); setNewVersionName(v.name); setNewVersionDesc(v.description); }} className="text-blue-500 p-1.5 hover:bg-blue-50 rounded"><Pencil size={16}/></button>
                                       <button onClick={() => { if(confirm('¿Eliminar versión?')) api.deleteVersion(v.id).then(loadVersions); }} className="text-red-500 p-1.5 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                   </div>
                               </div>
                               <p className="text-[10px] text-gray-400">Creada: {new Date(v.createdAt).toLocaleDateString()}</p>
                           </div>
                       ))}
                   </div>
               </div>
           )}

           {tab === 'USERS' && (
               <div className="space-y-6">
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                       <h3 className="font-bold text-slate-700 mb-4">{editingUserId ? '✏️ Editar Usuario' : '➕ Registrar Usuario'}</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Nombre completo" className="border p-2 rounded text-sm bg-white" />
                           <input value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="Email corporativo" className="border p-2 rounded text-sm bg-white" />
                           <input value={newUserPass} onChange={e => setNewUserPass(e.target.value)} type="password" placeholder={editingUserId ? "Dejar en blanco para no cambiar" : "Contraseña inicial"} className="border p-2 rounded text-sm bg-white" />
                           <select value={newUserRole} onChange={(e: any) => setNewUserRole(e.target.value)} className="border p-2 rounded text-sm bg-white">
                               <option value="USER">Usuario (Lectura/Carga)</option>
                               <option value="ADMIN">Administrador (Control Total)</option>
                           </select>
                       </div>
                       <div className="flex justify-end gap-2 mt-4">
                           {editingUserId && <button onClick={handleCancelEditUser} className="px-4 py-2 text-sm text-gray-500">Cancelar</button>}
                           <button onClick={saveUser} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm">{editingUserId ? 'Actualizar' : 'Crear Usuario'}</button>
                       </div>
                   </div>
                   <div className="space-y-2">
                       {users.map(u => (
                           <div key={u.id} className="flex justify-between items-center p-3 bg-white rounded-lg border hover:shadow-sm">
                               <div className="flex items-center gap-3">
                                   <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${u.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                       {u.name.charAt(0)}
                                   </div>
                                   <div>
                                       <p className="text-sm font-bold text-slate-800">{u.name} <span className="text-[10px] font-normal text-slate-400 ml-2">{u.email}</span></p>
                                       <p className="text-[10px] text-gray-400">{u.role}</p>
                                   </div>
                               </div>
                               <div className="flex gap-1">
                                   <button onClick={() => { setEditingUserId(u.id); setNewUserName(u.name); setNewUserEmail(u.email); setNewUserRole(u.role); }} className="text-blue-500 p-1.5 hover:bg-blue-50 rounded"><Pencil size={16}/></button>
                                   <button onClick={() => { if(confirm('¿Eliminar usuario?')) authService.deleteUser(u.id).then(loadUsers); }} className="text-red-500 p-1.5 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                               </div>
                           </div>
                       ))}
                   </div>
               </div>
           )}
       </div>
    </div>
  );
};

export default Settings;