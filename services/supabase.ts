
import { createClient } from '@supabase/supabase-js';
import { AppConfig, BudgetEntry, CompanyDetail, ExchangeRate, BudgetVersion, CategoryType, CategoryAssignment } from '../types';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

const mapEntryFromDB = (dbEntry: any): BudgetEntry => ({
    id: dbEntry.id,
    month: dbEntry.month,
    year: dbEntry.year,
    company: dbEntry.company_name,
    category: dbEntry.category_type as CategoryType,
    subCategory: dbEntry.subcategory,
    client: dbEntry.client_name || '',
    planValue: Number(dbEntry.plan_value),
    planUnits: Number(dbEntry.plan_units),
    realValue: Number(dbEntry.real_value),
    realUnits: Number(dbEntry.real_units),
    versionId: dbEntry.version_id,
    operatorRate: dbEntry.operator_rate,
    salePrice: dbEntry.sale_price,
    unitDirectCost: dbEntry.unit_direct_cost
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

export const api = {
    fetchConfig: async (): Promise<AppConfig | null> => {
        if (!supabase) return null;
        try {
            const { data: companies } = await supabase.from('companies').select('*');
            const { data: categories } = await supabase.from('categories').select('*');
            const { data: assignments } = await supabase.from('category_assignments').select('*');

            const config: AppConfig = {
                companies: companies?.map((c: any) => ({ id: c.id, name: c.name, currency: c.currency })) || [],
                categories: {
                    'Ingresos': categories?.filter((c:any) => c.type === 'Ingresos').map((c:any) => c.name) || [],
                    'Costos Directos': categories?.filter((c:any) => c.type === 'Costos Directos').map((c:any) => c.name) || [],
                    'Costos Indirectos': categories?.filter((c:any) => c.type === 'Costos Indirectos').map((c:any) => c.name) || [],
                },
                assignments: assignments?.map((a: any) => ({
                    companyName: a.company_name,
                    categoryType: a.category_type,
                    categoryName: a.category_name,
                    clientName: a.client_name || ''
                })) || [],
                clients: Array.from(new Set(assignments?.map((a:any) => a.client_name).filter(Boolean)))
            };
            return config;
        } catch (error) { return null; }
    },

    fetchBudgetData: async (versionId: string) => {
        if (!supabase) return { entries: [], rates: [] };
        const { data: entriesData } = await supabase.from('budget_entries').select('*').eq('version_id', versionId);
        const { data: ratesData } = await supabase.from('exchange_rates').select('*').eq('version_id', versionId);
        return {
            entries: entriesData?.map(mapEntryFromDB) || [],
            rates: ratesData?.map(mapRateFromDB) || []
        };
    },

    fetchVersions: async (): Promise<BudgetVersion[]> => {
        if (!supabase) return [];
        const { data } = await supabase.from('budget_versions').select('*').order('created_at', { ascending: true });
        return data?.map((v: any) => ({ id: v.id, name: v.name, description: v.description, isActive: v.is_active, createdAt: v.created_at })) || [];
    },

    bulkUpdateAssignments: async (assignments: CategoryAssignment[]) => {
        if (!supabase) return;
        // 1. Borrar todas
        await supabase.from('category_assignments').delete().neq('company_name', 'FORCE_DELETE');
        
        // 2. Insertar nuevas categorías únicas para que existan en la tabla maestra
        const uniqueCats = Array.from(new Set(assignments.map(a => `${a.categoryType}|${a.categoryName}`)));
        for (const catStr of uniqueCats) {
            const [type, name] = catStr.split('|');
            await supabase.from('categories').upsert({ type, name }, { onConflict: 'type,name' });
        }

        // 3. Insertar asignaciones
        const rows = assignments.map(a => ({
            company_name: a.companyName,
            category_type: a.categoryType,
            category_name: a.categoryName,
            client_name: a.clientName || null
        }));
        await supabase.from('category_assignments').insert(rows);
    },

    addIndividualAssignment: async (type: string, concept: string, client: string, companies: string[]) => {
        if (!supabase) return;
        const rows = companies.map(cn => ({
            company_name: cn,
            category_type: type,
            category_name: concept,
            client_name: client || null
        }));
        await supabase.from('category_assignments').insert(rows);
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
            client_name: entry.client || null,
            plan_value: entry.planValue,
            plan_units: entry.planUnits,
            real_value: entry.realValue,
            real_units: entry.realUnits
        };
        await supabase.from('budget_entries').upsert(payload, { onConflict: 'version_id,company_name,month,category_type,subcategory,client_name' });
    },

    // Fix: Added missing upsertRate method to handle single exchange rate updates
    upsertRate: async (rate: ExchangeRate) => {
        if (!supabase) return;
        const payload = {
            id: rate.id,
            company_name: rate.company,
            month: rate.month,
            year: rate.year,
            version_id: rate.versionId,
            plan_rate: rate.planRate,
            real_rate: rate.realRate
        };
        await supabase.from('exchange_rates').upsert(payload, { onConflict: 'id' });
    },

    // Fix: Added missing upsertRates method for batch exchange rate updates
    upsertRates: async (rates: ExchangeRate[]) => {
        if (!supabase) return;
        const payloads = rates.map(rate => ({
            id: rate.id,
            company_name: rate.company,
            month: rate.month,
            year: rate.year,
            version_id: rate.versionId,
            plan_rate: rate.planRate,
            real_rate: rate.realRate
        }));
        await supabase.from('exchange_rates').upsert(payloads, { onConflict: 'id' });
    },

    updateVersion: async (id: string, name: string, description: string) => {
        if (!supabase) return;
        await supabase.from('budget_versions').update({ name, description }).eq('id', id);
    },
    createVersion: async (name: string, description: string) => {
        if (!supabase) return;
        await supabase.from('budget_versions').insert({ name, description });
    },
    deleteVersion: async (id: string) => {
        if (!supabase) return;
        await supabase.from('budget_versions').delete().eq('id', id);
    },
    cloneVersion: async (sourceVersionId: string, newName: string, newDescription: string) => {
        if (!supabase) return;
        await supabase.rpc('clone_budget_version', { source_version_id: sourceVersionId, new_version_name: newName, new_description: newDescription });
    },
    updateCompany: async (oldName: string, newCompany: CompanyDetail) => {
        if(!supabase) return;
        await supabase.from('companies').update({ name: newCompany.name, currency: newCompany.currency }).eq('name', oldName);
    },
    addCompany: async (company: CompanyDetail) => {
        if(!supabase) return;
        await supabase.from('companies').insert({ name: company.name, currency: company.currency });
    },
    deleteCompany: async (name: string) => {
        if(!supabase) return;
        await supabase.from('companies').delete().eq('name', name);
    },
    addCategory: async (type: string, name: string) => {
        if(!supabase) return;
        await supabase.from('categories').upsert({ type, name }, { onConflict: 'type,name' });
    },

    // Fix: Added missing updateCategory method to support concept renaming
    updateCategory: async (type: string, oldName: string, newName: string) => {
        if (!supabase) return;
        await supabase.from('categories').update({ name: newName }).match({ type, name: oldName });
    },

    deleteCategory: async (type: string, name: string) => {
        if(!supabase) return;
        await supabase.from('categories').delete().match({ type, name });
    }
};
