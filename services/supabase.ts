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
    company: (dbEntry.company_name || '').trim(),
    category: dbEntry.category_type as CategoryType,
    subCategory: (dbEntry.subcategory || '').trim(),
    client: (dbEntry.client_name || '').trim(), // Convertimos null a "" siempre
    planValue: Number(dbEntry.plan_value || 0),
    planUnits: Number(dbEntry.plan_units || 0),
    realValue: Number(dbEntry.real_value || 0),
    realUnits: Number(dbEntry.real_units || 0),
    versionId: dbEntry.version_id,
    operatorRate: dbEntry.operator_rate,
    salePrice: Number(dbEntry.sale_price || 0),
    unitDirectCost: Number(dbEntry.unit_direct_cost || 0),
    realSalePrice: Number(dbEntry.real_sale_price || 0),
    realUnitDirectCost: Number(dbEntry.real_unit_direct_cost || 0)
});

const mapRateFromDB = (dbRate: any): ExchangeRate => ({
    id: dbRate.id,
    company: (dbRate.company_name || '').trim(),
    month: dbRate.month,
    year: dbRate.year,
    versionId: dbRate.version_id,
    planRate: Number(dbRate.plan_rate || 1),
    realRate: Number(dbRate.real_rate || 1)
});

export const api = {
    fetchConfig: async (): Promise<AppConfig | null> => {
        if (!supabase) return null;
        try {
            const [compRes, catRes, assignRes] = await Promise.all([
                supabase.from('companies').select('*'),
                supabase.from('categories').select('*'),
                supabase.from('category_assignments').select('*')
            ]);

            if (compRes.error) throw compRes.error;
            const assignments = assignRes.data?.map((a: any) => ({
                companyName: (a.company_name || '').trim(),
                categoryType: a.category_type,
                categoryName: (a.category_name || '').trim(),
                clientName: (a.client_name || '').trim()
            })) || [];

            return {
                companies: compRes.data?.map((c: any) => ({ id: c.id, name: c.name.trim(), currency: c.currency })) || [],
                categories: {
                    'Ingresos': catRes.data?.filter((c:any) => c.type === 'Ingresos').map((c:any) => c.name.trim()) || [],
                    'Costos Directos': catRes.data?.filter((c:any) => c.type === 'Costos Directos').map((c:any) => c.name.trim()) || [],
                    'Costos Indirectos': catRes.data?.filter((c:any) => c.type === 'Costos Indirectos').map((c:any) => c.name.trim()) || [],
                },
                assignments: assignments,
                clients: Array.from(new Set(assignments.map(a => a.clientName).filter(Boolean)))
            };
        } catch (error) { 
            console.error("Error fetching config:", error);
            return null; 
        }
    },

    fetchBudgetData: async (versionId: string) => {
        if (!supabase) return { entries: [], rates: [] };
        const [entriesRes, ratesRes] = await Promise.all([
            supabase.from('budget_entries').select('*').eq('version_id', versionId),
            supabase.from('exchange_rates').select('*').eq('version_id', versionId)
        ]);
        return {
            entries: entriesRes.data?.map(mapEntryFromDB) || [],
            rates: ratesRes.data?.map(mapRateFromDB) || []
        };
    },

    fetchVersions: async (): Promise<BudgetVersion[]> => {
        if (!supabase) return [];
        const { data } = await supabase.from('budget_versions').select('*').order('created_at', { ascending: true });
        return data?.map((v: any) => ({ id: v.id, name: v.name, description: v.description, isActive: v.is_active, createdAt: v.created_at })) || [];
    },

    bulkUpdateAssignments: async (assignments: CategoryAssignment[]) => {
        if (!supabase) return;
        const cleanAssignments = assignments.map(a => ({
            company_name: a.companyName.trim(),
            category_type: a.categoryType,
            category_name: a.categoryName.trim(),
            client_name: (a.clientName || '').trim()
        }));
        await supabase.from('category_assignments').delete().neq('category_type', 'FORCE_DELETE_ALL');
        await supabase.from('category_assignments').insert(cleanAssignments);
    },

    addIndividualAssignment: async (type: string, name: string, client: string, companies: string[]) => {
        if (!supabase) return;
        const rows = companies.map(cn => ({
            company_name: cn.trim(),
            category_type: type,
            category_name: name.trim(),
            client_name: (client || '').trim()
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
            client_name: (entry.client || '').trim(), // Crucial: siempre enviar string
            plan_value: entry.planValue || 0,
            plan_units: entry.planUnits || 0,
            real_value: entry.realValue || 0,
            real_units: entry.realUnits || 0,
            sale_price: entry.salePrice || 0,
            unit_direct_cost: entry.unitDirectCost || 0,
            real_sale_price: entry.realSalePrice || 0,
            real_unit_direct_cost: entry.realUnitDirectCost || 0
        };
        const { error } = await supabase.from('budget_entries').upsert(payload, { onConflict: 'version_id,company_name,month,category_type,subcategory,client_name' });
        if (error) console.error("Upsert Entry Error:", error);
    },

    bulkUpsertEntries: async (entries: BudgetEntry[]) => {
        if (!supabase || entries.length === 0) return;
        const payloads = entries.map(e => ({
            version_id: e.versionId,
            company_name: e.company.trim(),
            month: e.month,
            year: e.year,
            category_type: e.category,
            subcategory: e.subCategory.trim(),
            client_name: (e.client || '').trim(), // Siempre string ""
            plan_value: e.planValue || 0,
            plan_units: e.planUnits || 0,
            real_value: e.realValue || 0,
            real_units: e.realUnits || 0,
            sale_price: e.salePrice || 0,
            unit_direct_cost: e.unitDirectCost || 0,
            real_sale_price: e.realSalePrice || 0,
            real_unit_direct_cost: e.realUnitDirectCost || 0
        }));
        const { error } = await supabase.from('budget_entries').upsert(payloads, { onConflict: 'version_id,company_name,month,category_type,subcategory,client_name' });
        if (error) {
            console.error("Bulk Upsert Error Details:", error);
            throw new Error(error.message);
        }
    },

    upsertRate: async (rate: ExchangeRate) => {
        if (!supabase) return;
        await supabase.from('exchange_rates').upsert({
            company_name: rate.company.trim(),
            month: rate.month,
            year: rate.year,
            version_id: rate.versionId,
            plan_rate: rate.planRate,
            real_rate: rate.realRate
        }, { onConflict: 'version_id,company_name,month' });
    },

    upsertRates: async (rates: ExchangeRate[]) => {
        if (!supabase) return;
        const payloads = rates.map(rate => ({
            company_name: rate.company.trim(),
            month: rate.month,
            year: rate.year,
            version_id: rate.versionId,
            plan_rate: rate.planRate,
            real_rate: rate.realRate
        }));
        await supabase.from('exchange_rates').upsert(payloads, { onConflict: 'version_id,company_name,month' });
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