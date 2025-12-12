import { createClient } from '@supabase/supabase-js';
import { AppConfig, BudgetEntry, CompanyDetail, ExchangeRate, BudgetVersion, CategoryType } from '../types';

// --- CONFIGURACIÓN ---
// En Vite (Vercel), las variables se acceden con import.meta.env.VITE_...
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
            const { data: companies, error: errCo } = await supabase.from('companies').select('*');
            if (errCo) throw errCo;
            const { data: categories, error: errCat } = await supabase.from('categories').select('*');
            if (errCat) throw errCat;

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
                }
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
        await supabase.from('companies').insert({ name: company.name, currency: company.currency });
    },
    
    updateCompany: async (oldName: string, newCompany: CompanyDetail) => {
        if(!supabase) return;
        // Cascade update: Companies table first
        await supabase.from('companies').update({ name: newCompany.name, currency: newCompany.currency }).eq('name', oldName);
        // Then Budget entries
        await supabase.from('budget_entries').update({ company_name: newCompany.name }).eq('company_name', oldName);
        // Then Exchange rates
        await supabase.from('exchange_rates').update({ company_name: newCompany.name }).eq('company_name', oldName);
    },

    deleteCompany: async (name: string) => {
        if(!supabase) return;
        await supabase.from('companies').delete().eq('name', name);
        await supabase.from('budget_entries').delete().eq('company_name', name);
        await supabase.from('exchange_rates').delete().eq('company_name', name);
    },

    addCategory: async (type: string, name: string) => {
        if(!supabase) return;
        await supabase.from('categories').insert({ type, name });
    },

    deleteCategory: async (type: string, name: string) => {
        if(!supabase) return;
        await supabase.from('categories').delete().match({ type, name });
        await supabase.from('budget_entries').delete().match({ category_type: type, subcategory: name });
    },
    
    updateCategory: async (type: string, oldName: string, newName: string) => {
        if(!supabase) return;
        await supabase.from('categories').update({ name: newName }).match({ type, name: oldName });
        await supabase.from('budget_entries').update({ subcategory: newName }).match({ category_type: type, subcategory: oldName });
    }
};
