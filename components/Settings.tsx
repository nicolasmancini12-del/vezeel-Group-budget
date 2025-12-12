import React, { useState, useEffect } from 'react';
import { AppConfig, CategoryType, CATEGORY_TYPES, CompanyDetail, AppUser, BudgetVersion } from '../types';
import { generateId } from '../constants';
import { authService } from '../services/authService';
import { api } from '../services/supabase';
import { Pencil, Trash2, X } from 'lucide-react';

interface SettingsProps {
  config: AppConfig;
  onUpdateConfig: (newConfig: AppConfig) => void;
  onRenameCompany: (oldName: string, newCompanyDetail: CompanyDetail) => void;
  onRenameConcept: (catType: string, oldName: string, newName: string) => void;
  onAddCompany?: (company: CompanyDetail) => void;
  onRemoveCompany?: (name: string) => void;
  onAddCategory?: (type: CategoryType, name: string) => void;
  onRemoveCategory?: (type: CategoryType, name: string) => void;
  onVersionsUpdated?: () => void; 
}

const Settings: React.FC<SettingsProps> = ({ 
    config, onUpdateConfig, onRenameCompany, onRenameConcept,
    onAddCompany, onRemoveCompany, onAddCategory, onRemoveCategory,
    onVersionsUpdated
}) => {
  const [tab, setTab] = useState<'GENERAL' | 'VERSIONS' | 'USERS'>('GENERAL');
  
  // --- GENERAL STATE ---
  const [editingCompanyOldName, setEditingCompanyOldName] = useState<string | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCurrency, setNewCompanyCurrency] = useState('USD');
  const [newConcept, setNewConcept] = useState('');
  const [selectedCategoryType, setSelectedCategoryType] = useState<CategoryType>('Ingresos');

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

  // --- LOADERS ---
  const loadUsers = async () => {
      const data = await authService.getUsers();
      setUsers(data);
  };

  const loadVersions = async () => {
      const data = await api.fetchVersions();
      setVersions(data);
      if(data.length > 0 && !cloneSourceId) setCloneSourceId(data[0].id);
  };

  // --- HANDLERS: COMPANIES ---
  const handleEditCompany = (c: CompanyDetail) => {
      setEditingCompanyOldName(c.name);
      setNewCompanyName(c.name);
      setNewCompanyCurrency(c.currency);
  };

  const handleCancelEditCompany = () => {
      setEditingCompanyOldName(null);
      setNewCompanyName('');
      setNewCompanyCurrency('USD');
  };

  const saveCompany = () => {
      if (!newCompanyName.trim()) return;
      
      if (editingCompanyOldName) {
          // Update Mode
          const updatedCompany: CompanyDetail = { 
              id: generateId(), // ID not used for matching, name is key
              name: newCompanyName.trim(), 
              currency: newCompanyCurrency 
          };
          onRenameCompany(editingCompanyOldName, updatedCompany);
          handleCancelEditCompany();
      } else {
          // Create Mode
          const newCompany: CompanyDetail = { 
              id: generateId(), 
              name: newCompanyName.trim(), 
              currency: newCompanyCurrency 
          };
          if (onAddCompany) onAddCompany(newCompany);
          setNewCompanyName('');
      }
  };

  // --- HANDLERS: VERSIONS ---
  const handleEditVersion = (v: BudgetVersion) => {
      setEditingVersionId(v.id);
      setNewVersionName(v.name);
      setNewVersionDesc(v.description);
      setCloneSourceId(''); // Hide clone when editing
  };

  const handleCancelEditVersion = () => {
      setEditingVersionId(null);
      setNewVersionName('');
      setNewVersionDesc('');
      if(versions.length > 0) setCloneSourceId(versions[0].id);
  };

  const saveVersion = async () => {
      if (!newVersionName.trim()) return;
      
      if (editingVersionId) {
          // Update
          await api.updateVersion(editingVersionId, newVersionName, newVersionDesc);
          handleCancelEditVersion();
      } else {
          // Create
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
      if(onVersionsUpdated) onVersionsUpdated();
  };

  const handleDeleteVersion = async (id: string) => {
      if(confirm('¿Borrar versión y TODOS sus datos? Esta acción no se puede deshacer.')) {
          await api.deleteVersion(id);
          loadVersions();
          if(onVersionsUpdated) onVersionsUpdated();
      }
  };

  // --- HANDLERS: USERS ---
  const handleEditUser = (u: AppUser) => {
      setEditingUserId(u.id);
      setNewUserName(u.name);
      setNewUserEmail(u.email);
      setNewUserRole(u.role);
      setNewUserPass(''); // Don't show password
  };

  const handleCancelEditUser = () => {
      setEditingUserId(null);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('USER');
      setNewUserPass('');
  };

  const saveUser = async () => {
      if (!newUserName || !newUserEmail) return;

      if (editingUserId) {
          // Update
          await authService.updateUser({
              id: editingUserId,
              name: newUserName,
              email: newUserEmail,
              role: newUserRole,
              password: newUserPass // Can be empty
          });
          handleCancelEditUser();
      } else {
          // Create
          if (!newUserPass) return alert('La contraseña es obligatoria para nuevos usuarios');
          await authService.createUser({
              email: newUserEmail,
              password: newUserPass, 
              name: newUserName,
              role: newUserRole
          });
          setNewUserEmail(''); setNewUserPass(''); setNewUserName('');
      }
      loadUsers();
  };

  const handleDeleteUser = async (id: string) => {
      if(confirm('¿Eliminar usuario?')) {
          await authService.deleteUser(id);
          loadUsers();
      }
  };

  // --- HANDLERS: CONCEPTS ---
  const addConcept = () => {
      if (newConcept.trim() && onAddCategory) {
          onAddCategory(selectedCategoryType, newConcept.trim());
          setNewConcept('');
      }
  };


  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col">
       <div className="flex border-b border-gray-200 bg-slate-50 overflow-x-auto">
           <button 
             onClick={() => setTab('GENERAL')}
             className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${tab === 'GENERAL' ? 'bg-white border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
           >
               🏢 Empresas y Conceptos
           </button>
           <button 
             onClick={() => setTab('VERSIONS')}
             className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${tab === 'VERSIONS' ? 'bg-white border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
           >
               📅 Versiones
           </button>
           <button 
             onClick={() => setTab('USERS')}
             className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${tab === 'USERS' ? 'bg-white border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
           >
               👥 Usuarios
           </button>
       </div>

       <div className="p-6 overflow-y-auto flex-1 pb-20">
           
           {/* --- TAB: GENERAL --- */}
           {tab === 'GENERAL' && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div>
                       <h3 className="font-bold text-slate-700 mb-4">Empresas</h3>
                       
                       {/* Add/Edit Company Form */}
                       <div className={`p-3 rounded-lg border mb-4 ${editingCompanyOldName ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-gray-100'}`}>
                           <p className="text-xs font-bold text-gray-500 mb-2">
                               {editingCompanyOldName ? '✏️ Editando Empresa' : '➕ Nueva Empresa'}
                           </p>
                           <div className="flex gap-2">
                               <input value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} placeholder="Nombre..." className="border p-2 rounded flex-1 text-sm" />
                               <select value={newCompanyCurrency} onChange={e => setNewCompanyCurrency(e.target.value)} className="border p-2 rounded text-sm bg-white"><option>USD</option><option>ARS</option><option>MXN</option></select>
                           </div>
                           <div className="flex justify-end gap-2 mt-2">
                               {editingCompanyOldName && (
                                   <button onClick={handleCancelEditCompany} className="text-gray-500 px-3 py-1 rounded text-sm hover:bg-gray-200">Cancelar</button>
                               )}
                               <button onClick={saveCompany} className={`${editingCompanyOldName ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-3 py-1 rounded text-sm shadow-sm transition-colors`}>
                                   {editingCompanyOldName ? 'Guardar Cambios' : 'Agregar'}
                               </button>
                           </div>
                       </div>

                       <ul className="space-y-2">
                           {config.companies.map(c => (
                               <li key={c.id} className="flex justify-between items-center bg-white p-2 rounded border hover:shadow-sm">
                                   <span className="text-sm">{c.name} <span className="text-gray-400">({c.currency})</span></span>
                                   <div className="flex gap-1">
                                       <button onClick={() => handleEditCompany(c)} className="text-blue-500 p-1 hover:bg-blue-50 rounded" title="Editar"><Pencil size={14} /></button>
                                       <button onClick={() => onRemoveCompany && onRemoveCompany(c.name)} className="text-red-500 p-1 hover:bg-red-50 rounded" title="Eliminar"><Trash2 size={14} /></button>
                                   </div>
                               </li>
                           ))}
                       </ul>
                   </div>
                   
                   <div>
                       <h3 className="font-bold text-slate-700 mb-4">Conceptos</h3>
                       <div className="flex gap-2 mb-2">
                           {CATEGORY_TYPES.map(t => (
                               <button key={t} onClick={() => setSelectedCategoryType(t)} className={`text-xs px-2 py-1 rounded ${selectedCategoryType===t ? 'bg-slate-800 text-white' : 'bg-gray-100'}`}>{t}</button>
                           ))}
                       </div>
                       <div className="flex gap-2 mb-4">
                           <input value={newConcept} onChange={e => setNewConcept(e.target.value)} placeholder="Concepto..." className="border p-2 rounded flex-1 text-sm" />
                           <button onClick={addConcept} className="bg-emerald-600 text-white px-3 py-1 rounded text-sm hover:bg-emerald-700">Agregar</button>
                       </div>
                       <div className="max-h-60 overflow-y-auto">
                           {config.categories[selectedCategoryType].map(c => (
                               <div key={c} className="flex justify-between items-center p-2 border-b text-sm">
                                   <span>{c}</span>
                                   <button onClick={() => onRemoveCategory && onRemoveCategory(selectedCategoryType, c)} className="text-red-500 text-xs hover:bg-red-50 p-1 rounded"><X size={14} /></button>
                               </div>
                           ))}
                       </div>
                   </div>
               </div>
           )}

           {/* --- TAB: VERSIONS --- */}
           {tab === 'VERSIONS' && (
               <div>
                   <div className={`${editingVersionId ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-100'} p-4 rounded-lg mb-6 border transition-colors`}>
                       <h3 className={`font-bold ${editingVersionId ? 'text-amber-800' : 'text-indigo-800'} mb-2`}>
                           {editingVersionId ? '✏️ Editar Versión' : '➕ Crear o Clonar Versión'}
                       </h3>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                               <label className="text-xs font-bold text-gray-500">Nombre de Versión</label>
                               <input value={newVersionName} onChange={e => setNewVersionName(e.target.value)} placeholder="Ej: Escenario Optimista 2026" className="w-full border p-2 rounded text-sm mt-1 focus:ring-2 focus:ring-indigo-200 outline-none" />
                           </div>
                           
                           {!editingVersionId && (
                               <div>
                                   <label className="text-xs font-bold text-gray-500">Copiar desde (Clonar)</label>
                                   <select value={cloneSourceId} onChange={e => setCloneSourceId(e.target.value)} className="w-full border p-2 rounded text-sm mt-1 bg-white">
                                       <option value="">-- Crear Vacía --</option>
                                       {versions.map(v => (
                                           <option key={v.id} value={v.id}>{v.name}</option>
                                       ))}
                                   </select>
                               </div>
                           )}

                           <div className="md:col-span-2">
                               <input value={newVersionDesc} onChange={e => setNewVersionDesc(e.target.value)} placeholder="Descripción opcional" className="w-full border p-2 rounded text-sm" />
                           </div>
                           
                           <div className="md:col-span-2 flex justify-end gap-2">
                               {editingVersionId && (
                                   <button onClick={handleCancelEditVersion} className="text-gray-500 px-4 py-2 rounded text-sm hover:bg-gray-100 font-medium">Cancelar</button>
                               )}
                               <button onClick={saveVersion} className={`${editingVersionId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-4 py-2 rounded text-sm font-bold shadow-sm transition-colors`}>
                                   {editingVersionId ? 'Guardar Cambios' : (cloneSourceId ? '✨ Clonar Versión' : 'Crear Versión')}
                               </button>
                           </div>
                       </div>
                   </div>

                   <table className="w-full text-left border-collapse">
                       <thead>
                           <tr className="border-b bg-gray-50">
                               <th className="p-3 text-sm font-bold text-gray-600">Nombre</th>
                               <th className="p-3 text-sm font-bold text-gray-600">Descripción</th>
                               <th className="p-3 text-sm font-bold text-gray-600">Fecha</th>
                               <th className="p-3 text-sm font-bold text-gray-600 text-right">Acciones</th>
                           </tr>
                       </thead>
                       <tbody>
                           {versions.map(v => (
                               <tr key={v.id} className={`border-b hover:bg-slate-50 ${editingVersionId === v.id ? 'bg-amber-50' : ''}`}>
                                   <td className="p-3 text-sm font-medium">{v.name}</td>
                                   <td className="p-3 text-sm text-gray-500">{v.description}</td>
                                   <td className="p-3 text-sm text-gray-400">{new Date(v.createdAt).toLocaleDateString()}</td>
                                   <td className="p-3 text-right">
                                       <div className="flex justify-end gap-1">
                                            <button onClick={() => handleEditVersion(v)} className="text-blue-500 p-1 hover:bg-blue-50 rounded" title="Editar"><Pencil size={16} /></button>
                                            <button onClick={() => handleDeleteVersion(v.id)} className="text-red-500 p-1 hover:bg-red-50 rounded" title="Eliminar"><Trash2 size={16} /></button>
                                       </div>
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
           )}

           {/* --- TAB: USERS --- */}
           {tab === 'USERS' && (
               <div>
                   <div className={`${editingUserId ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-100'} p-4 rounded-lg mb-6 border transition-colors`}>
                       <h3 className={`font-bold ${editingUserId ? 'text-amber-800' : 'text-blue-800'} mb-2`}>
                           {editingUserId ? '✏️ Editar Usuario' : '➕ Crear Nuevo Usuario'}
                       </h3>
                       <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                           <input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Nombre Completo" className="border p-2 rounded text-sm" />
                           <input value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="Email" className="border p-2 rounded text-sm" />
                           <input value={newUserPass} onChange={e => setNewUserPass(e.target.value)} placeholder={editingUserId ? "Nueva contraseña (opcional)" : "Contraseña"} type="password" className="border p-2 rounded text-sm" />
                           <div className="flex gap-2">
                               <select value={newUserRole} onChange={(e:any) => setNewUserRole(e.target.value)} className="border p-2 rounded text-sm bg-white">
                                   <option value="USER">Usuario</option>
                                   <option value="ADMIN">Administrador</option>
                               </select>
                           </div>
                           <div className="md:col-span-4 flex justify-end gap-2 mt-2">
                                {editingUserId && (
                                   <button onClick={handleCancelEditUser} className="text-gray-500 px-3 py-1 rounded text-sm hover:bg-gray-200">Cancelar</button>
                               )}
                               <button onClick={saveUser} className={`${editingUserId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-2 rounded text-sm font-bold shadow-sm transition-colors`}>
                                   {editingUserId ? 'Guardar Cambios' : 'Crear'}
                               </button>
                           </div>
                       </div>
                   </div>

                   <table className="w-full text-left border-collapse">
                       <thead>
                           <tr className="border-b">
                               <th className="p-3 text-sm font-bold text-gray-600">Nombre</th>
                               <th className="p-3 text-sm font-bold text-gray-600">Email</th>
                               <th className="p-3 text-sm font-bold text-gray-600">Rol</th>
                               <th className="p-3 text-sm font-bold text-gray-600 text-right">Acciones</th>
                           </tr>
                       </thead>
                       <tbody>
                           {users.map(u => (
                               <tr key={u.id} className={`border-b hover:bg-slate-50 ${editingUserId === u.id ? 'bg-amber-50' : ''}`}>
                                   <td className="p-3 text-sm">{u.name}</td>
                                   <td className="p-3 text-sm">{u.email}</td>
                                   <td className="p-3 text-sm">
                                       <span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                                           {u.role}
                                       </span>
                                   </td>
                                   <td className="p-3 text-right">
                                       <div className="flex justify-end gap-1">
                                            <button onClick={() => handleEditUser(u)} className="text-blue-500 p-1 hover:bg-blue-50 rounded" title="Editar"><Pencil size={16} /></button>
                                            <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 p-1 hover:bg-red-50 rounded" title="Eliminar"><Trash2 size={16} /></button>
                                       </div>
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
           )}
       </div>
    </div>
  );
};

export default Settings;
