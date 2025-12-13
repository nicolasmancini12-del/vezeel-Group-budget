import { createClient } from '@supabase/supabase-js';
import { AppConfig, BudgetEntry, CompanyDetail, ExchangeRate, BudgetVersion, CategoryType, CategoryAssignment } from '../types';

// --- CONFIGURACIÓN ---
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// --- MAPEOS (Frontend <-> Database) ---
const mapEntryFromDB = (dbEntry: any): BudgetEntry => ({
    id: dbEntry.id,
    month: dbEntry.month,
    year: dbEntry.year,
    company: dbEntry.company_name,
    category: dbEntry.category_type as CategoryType,
    subCategory: dbEntry.subcategory,
    planValue: Number(dbEntry.plan_value),
    planUnits: Number(dbEntry.plan_units),
    realValue: Number(dbEntry.real_value),
    realUnits: Number(dbEntry.real_units),
    versionId: dbEntry.version_id
});

const mapRateFromDB = (dbRate: any): ExchangeRate => ({
    id: dbRate.id,
    company: dbRate.company_name,
    month: dbRate.month,
    year: dbRate.year,
    versionId: dbRate.version_id,
    planRate: Number(dbRate.plan_rate),
    realRate: Number(dbRate.real_rate)
});

// --- API METHODS ---

export const api = {
    fetchConfig: async (): Promise<AppConfig | null> => {
        if (!supabase) return null;
        try {
            // 1. Fetch Companies
            const { data: companies, error: errCo } = await supabase.from('companies').select('*');
            if (errCo) {
                console.error("Error loading companies:", errCo);
                throw errCo;
            }

            // 2. Fetch Categories
            const { data: categories, error: errCat } = await supabase.from('categories').select('*');
            if (errCat) {
                console.error("Error loading categories:", errCat);
                throw errCat;
            }

            // 3. Fetch Assignments (Resilient)
            let assignmentsData: any[] = [];
            try {
                const { data: assignments, error: errAss } = await supabase.from('category_assignments').select('*');
                if (!errAss && assignments) {
                    assignmentsData = assignments;
                }
            } catch (e) {
                console.warn("Could not load category_assignments table.", e);
            }

            // 4. Construct Config
            const config: AppConfig = {
                companies: companies.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    currency: c.currency
                })),
                categories: {
                    'Ingresos': categories.filter((c:any) => c.type === 'Ingresos').map((c:any) => c.name),
                    'Costos Directos': categories.filter((c:any) => c.type === 'Costos Directos').map((c:any) => c.name),
                    'Costos Indirectos': categories.filter((c:any) => c.type === 'Costos Indirectos').map((c:any) => c.name),
                },
                assignments: assignmentsData.map((a: any) => ({
                    companyName: a.company_name,
                    categoryType: a.category_type,
                    categoryName: a.category_name
                }))
            };
            
            return config;
        } catch (error) {
            console.error("Error fetching config:", error);
            return null;
        }
    },

    fetchBudgetData: async (versionId: string) => {
        if (!supabase) return { entries: [], rates: [] };
        try {
            const { data: entriesData, error: errEnt } = await supabase
                .from('budget_entries')
                .select('*')
                .eq('version_id', versionId);
            if (errEnt) throw errEnt;

            const { data: ratesData, error: errRat } = await supabase
                .from('exchange_rates')
                .select('*')
                .eq('version_id', versionId);
            if (errRat) throw errRat;

            return {
                entries: entriesData.map(mapEntryFromDB),
                rates: ratesData.map(mapRateFromDB)
            };

        } catch (error) {
            console.error("Error fetching budget data:", error);
            return { entries: [], rates: [] };
        }
    },

    fetchVersions: async (): Promise<BudgetVersion[]> => {
        if (!supabase) return [];
        const { data, error } = await supabase.from('budget_versions').select('*').order('created_at', { ascending: true });
        if (error) {
            console.error("Error fetching versions", error);
            return [];
        }
        return data.map((v: any) => ({
            id: v.id,
            name: v.name,
            description: v.description,
            isActive: v.is_active,
            createdAt: v.created_at
        }));
    },

    createVersion: async (name: string, description: string) => {
        if (!supabase) return;
        await supabase.from('budget_versions').insert({ name, description });
    },

    updateVersion: async (id: string, name: string, description: string) => {
        if (!supabase) return;
        await supabase.from('budget_versions').update({ name, description }).eq('id', id);
    },

    cloneVersion: async (sourceVersionId: string, newName: string, newDescription: string) => {
        if (!supabase) return;
        const { error } = await supabase.rpc('clone_budget_version', {
            source_version_id: sourceVersionId,
            new_version_name: newName,
            new_description: newDescription
        });
        if (error) throw error;
    },

    deleteVersion: async (id: string) => {
        if (!supabase) return;
        await supabase.from('budget_versions').delete().eq('id', id);
    },

    upsertEntry: async (entry: BudgetEntry) => {
        if (!supabase) return;
        const payload = {
            version_id: entry.versionId,
            company_name: entry.company,
            month: entry.month,
            year: entry.year,
            category_type: entry.category,
            subcategory: entry.subCategory,
            plan_value: entry.planValue,
            plan_units: entry.planUnits,
            real_value: entry.realValue,
            real_units: entry.realUnits
        };
        
        const { data } = await supabase.from('budget_entries').select('id').match({
            version_id: entry.versionId,
            company_name: entry.company,
            month: entry.month,
            category_type: entry.category,
            subcategory: entry.subCategory
        });

        if (data && data.length > 0) {
            await supabase.from('budget_entries').update(payload).eq('id', data[0].id);
        } else {
            await supabase.from('budget_entries').insert(payload);
        }
    },

    upsertRate: async (rate: ExchangeRate) => {
        if (!supabase) return;
        const payload = {
            version_id: rate.versionId,
            company_name: rate.company,
            month: rate.month,
            year: rate.year,
            plan_rate: rate.planRate,
            real_rate: rate.realRate
        };

        const { data } = await supabase.from('exchange_rates').select('id').match({
             version_id: rate.versionId,
             company_name: rate.company,
             month: rate.month
        });

        if (data && data.length > 0) {
            await supabase.from('exchange_rates').update(payload).eq('id', data[0].id);
        } else {
            await supabase.from('exchange_rates').insert(payload);
        }
    },

    addCompany: async (company: CompanyDetail) => {
        if(!supabase) return;
        
        const { error: errInsert } = await supabase.from('companies').insert({ name: company.name, currency: company.currency });
        if (errInsert) throw errInsert; 

        try {
            const { data: categories } = await supabase.from('categories').select('*');
            if (categories && categories.length > 0) {
                const assignments = categories.map((c: any) => ({
                    company_name: company.name,
                    category_type: c.type,
                    category_name: c.name
                }));
                await supabase.from('category_assignments').insert(assignments);
            }
        } catch (e) {
            console.error("Error auto-assigning categories", e);
        }
    },
    
    updateCompany: async (oldName: string, newCompany: CompanyDetail) => {
        if(!supabase) return;
        await supabase.from('companies').update({ name: newCompany.name, currency: newCompany.currency }).eq('name', oldName);
        await supabase.from('budget_entries').update({ company_name: newCompany.name }).eq('company_name', oldName);
        await supabase.from('exchange_rates').update({ company_name: newCompany.name }).eq('company_name', oldName);
        await supabase.from('category_assignments').update({ company_name: newCompany.name }).eq('company_name', oldName);
    },

    deleteCompany: async (name: string) => {
        if(!supabase) return;
        await supabase.from('companies').delete().eq('name', name);
        await supabase.from('budget_entries').delete().eq('company_name', name);
        await supabase.from('exchange_rates').delete().eq('company_name', name);
        await supabase.from('category_assignments').delete().eq('company_name', name);
    },

    addCategory: async (type: string, name: string) => {
        if(!supabase) return;
        await supabase.from('categories').insert({ type, name });
    },

    updateCategoryAssignments: async (type: string, name: string, companyNames: string[]) => {
        if(!supabase) return;
        
        // 1. Borrar existentes
        const { error: delError } = await supabase.from('category_assignments').delete().match({ category_type: type, category_name: name });
        if (delError) {
            console.error("Error borrando asignaciones:", delError);
            throw delError; // Lanzar para que el UI se entere
        }

        // 2. Insertar nuevos
        if (companyNames.length > 0) {
            const rows = companyNames.map(cn => ({
                company_name: cn,
                category_type: type,
                category_name: name
            }));
            const { error: insError } = await supabase.from('category_assignments').insert(rows);
            if (insError) {
                console.error("Error guardando asignaciones:", insError);
                throw insError;
            }
        }
    },

    deleteCategory: async (type: string, name: string) => {
        if(!supabase) return;
        await supabase.from('categories').delete().match({ type, name });
        await supabase.from('budget_entries').delete().match({ category_type: type, subcategory: name });
        await supabase.from('category_assignments').delete().match({ category_type: type, category_name: name });
    },
    
    updateCategory: async (type: string, oldName: string, newName: string) => {
        if(!supabase) return;
        await supabase.from('categories').update({ name: newName }).match({ type, name: oldName });
        await supabase.from('budget_entries').update({ subcategory: newName }).match({ category_type: type, subcategory: oldName });
        await supabase.from('category_assignments').update({ category_name: newName }).match({ category_type: type, category_name: oldName });
    }
};