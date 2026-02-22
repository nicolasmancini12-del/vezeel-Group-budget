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
    company: dbEntry.company_name.trim(),
    category: dbEntry.category_type as CategoryType,
    subCategory: dbEntry.subcategory.trim(),
    client: (dbEntry.client_name || '').trim(),
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
    company: dbRate.company_name.trim(),
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
                companies: companies?.map((c: any) => ({ id: c.id, name: c.name.trim(), currency: c.currency })) || [],
                categories: {
                    'Ingresos': categories?.filter((c:any) => c.type === 'Ingresos').map((c:any) => c.name.trim()) || [],
                    'Costos Directos': categories?.filter((c:any) => c.type === 'Costos Directos').map((c:any) => c.name.trim()) || [],
                    'Costos Indirectos': categories?.filter((c:any) => c.type === 'Costos Indirectos').map((c:any) => c.name.trim()) || [],
                },
                assignments: assignments?.map((a: any) => ({
                    companyName: a.company_name.trim(),
                    categoryType: a.category_type,
                    categoryName: a.category_name.trim(),
                    clientName: (a.client_name || '').trim()
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
        
        // Normalización de datos recibidos
        const cleanAssignments = assignments.map(a => ({
            company_name: a.companyName.trim(),
            category_type: a.categoryType,
            category_name: a.categoryName.trim(),
            client_name: (a.clientName || '').trim() || null
        }));

        // 1. Asegurar que las categorías existan en la tabla maestra
        const uniqueCats = Array.from(new Set(cleanAssignments.map(a => `${a.category_type}|${a.category_name}`)));
        for (const catStr of uniqueCats) {
            const [type, name] = catStr.split('|');
            await supabase.from('categories').upsert({ type, name }, { onConflict: 'type,name' });
        }

        // 2. Borrar todas las asignaciones existentes
        await supabase.from('category_assignments').delete().neq('company_name', 'FORCE_DELETE');
        
        // 3. Insertar nuevas asignaciones
        await supabase.from('category_assignments').insert(cleanAssignments);
    },

    addIndividualAssignment: async (type: string, concept: string, client: string, companies: string[]) => {
        if (!supabase) return;
        const rows = companies.map(cn => ({
            company_name: cn.trim(),
            category_type: type,
            category_name: concept.trim(),
            client_name: client.trim() || null
        }));
        await supabase.from('category_assignments').insert(rows);
    },

    upsertEntry: async (entry: BudgetEntry) => {
        if (!supabase) return;
        const payload = {
            version_id: entry.versionId,
            company_name: entry.company.trim(),
            month: entry.month,
            year: entry.year,
            category_type: entry.category,
            subcategory: entry.subCategory.trim(),
            client_name: (entry.client || '').trim() || null,
            plan_value: entry.planValue,
            plan_units: entry.planUnits,
            real_value: entry.realValue,
            real_units: entry.realUnits
        };
        await supabase.from('budget_entries').upsert(payload, { onConflict: 'version_id,company_name,month,category_type,subcategory,client_name' });
    },

    upsertRate: async (rate: ExchangeRate) => {
        if (!supabase) return;
        const payload = {
            id: rate.id,
            company_name: rate.company.trim(),
            month: rate.month,
            year: rate.year,
            version_id: rate.versionId,
            plan_rate: rate.planRate,
            real_rate: rate.realRate
        };
        await supabase.from('exchange_rates').upsert(payload, { onConflict: 'id' });
    },

    upsertRates: async (rates: ExchangeRate[]) => {
        if (!supabase) return;
        const payloads = rates.map(rate => ({
            id: rate.id,
            company_name: rate.company.trim(),
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
        await supabase.from('budget_versions').update({ name: name.trim(), description }).eq('id', id);
    },
    createVersion: async (name: string, description: string) => {
        if (!supabase) return;
        await supabase.from('budget_versions').insert({ name: name.trim(), description });
    },
    deleteVersion: async (id: string) => {
        if (!supabase) return;
        await supabase.from('budget_versions').delete().eq('id', id);
    },
    cloneVersion: async (sourceVersionId: string, newName: string, newDescription: string) => {
        if (!supabase) return;
        await supabase.rpc('clone_budget_version', { source_version_id: sourceVersionId, new_version_name: newName.trim(), new_description: newDescription });
    },
    updateCompany: async (oldName: string, newCompany: CompanyDetail) => {
        if(!supabase) return;
        await supabase.from('companies').update({ name: newCompany.name.trim(), currency: newCompany.currency }).eq('name', oldName.trim());
    },
    addCompany: async (company: CompanyDetail) => {
        if(!supabase) return;
        await supabase.from('companies').insert({ name: company.name.trim(), currency: company.currency });
    },
    deleteCompany: async (name: string) => {
        if(!supabase) return;
        await supabase.from('companies').delete().eq('name', name.trim());
    },
    addCategory: async (type: string, name: string) => {
        if(!supabase) return;
        await supabase.from('categories').upsert({ type, name: name.trim() }, { onConflict: 'type,name' });
    },
    updateCategory: async (type: string, oldName: string, newName: string) => {
        if (!supabase) return;
        await supabase.from('categories').update({ name: newName.trim() }).match({ type, name: oldName.trim() });
    },
    deleteCategory: async (type: string, name: string) => {
        if(!supabase) return;
        await supabase.from('categories').delete().match({ type, name: name.trim() });
    }
};