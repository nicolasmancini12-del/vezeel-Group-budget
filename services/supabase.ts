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
    client: (dbEntry.client_name || '').trim(),
    planValue: Number(dbEntry.plan_value || 0),
    planUnits: Number(dbEntry.plan_units || 0),
    realValue: Number(dbEntry.real_value || 0),
    realUnits: Number(dbEntry.real_units || 0),
    versionId: dbEntry.version_id,
    operatorRate: dbEntry.operator_rate,
    salePrice: dbEntry.sale_price,
    unitDirectCost: dbEntry.unit_direct_cost
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
            if (catRes.error) throw catRes.error;
            if (assignRes.error) throw assignRes.error;

            const assignments = assignRes.data?.map((a: any) => ({
                companyName: (a.company_name || '').trim(),
                categoryType: a.category_type,
                categoryName: (a.category_name || '').trim(),
                clientName: (a.client_name || '').trim()
            })) || [];

            const config: AppConfig = {
                companies: compRes.data?.map((c: any) => ({ id: c.id, name: c.name.trim(), currency: c.currency })) || [],
                categories: {
                    'Ingresos': catRes.data?.filter((c:any) => c.type === 'Ingresos').map((c:any) => c.name.trim()) || [],
                    'Costos Directos': catRes.data?.filter((c:any) => c.type === 'Costos Directos').map((c:any) => c.name.trim()) || [],
                    'Costos Indirectos': catRes.data?.filter((c:any) => c.type === 'Costos Indirectos').map((c:any) => c.name.trim()) || [],
                },
                assignments: assignments,
                clients: Array.from(new Set(assignments.map(a => a.clientName).filter(Boolean)))
            };
            return config;
        } catch (error) { 
            console.error("Error fetching config:", error);
            return null; 
        }
    },

    fetchBudgetData: async (versionId: string) => {
        if (!supabase) return { entries: [], rates: [] };
        const { data: entriesData, error: eErr } = await supabase.from('budget_entries').select('*').eq('version_id', versionId);
        const { data: ratesData, error: rErr } = await supabase.from('exchange_rates').select('*').eq('version_id', versionId);
        
        if (eErr) console.error("Error entries:", eErr);
        if (rErr) console.error("Error rates:", rErr);

        return {
            entries: entriesData?.map(mapEntryFromDB) || [],
            rates: ratesData?.map(mapRateFromDB) || []
        };
    },

    fetchVersions: async (): Promise<BudgetVersion[]> => {
        if (!supabase) return [];
        const { data, error } = await supabase.from('budget_versions').select('*').order('created_at', { ascending: true });
        if (error) console.error("Error versions:", error);
        return data?.map((v: any) => ({ id: v.id, name: v.name, description: v.description, isActive: v.is_active, createdAt: v.created_at })) || [];
    },

    bulkUpdateAssignments: async (assignments: CategoryAssignment[]) => {
        if (!supabase) return;
        
        const cleanAssignments = assignments.map(a => ({
            company_name: a.companyName.trim(),
            category_type: a.categoryType,
            category_name: a.categoryName.trim(),
            client_name: (a.clientName || '').trim() || null
        }));

        // 1. Asegurar categorías maestras
        const uniqueCats = Array.from(new Set(cleanAssignments.map(a => `${a.category_type}|${a.category_name}`)));
        for (const catStr of uniqueCats) {
            const [type, name] = catStr.split('|');
            const { error: catErr } = await supabase.from('categories').upsert({ type, name }, { onConflict: 'type,name' });
            if (catErr) throw new Error(`Error al crear categoría master "${name}": ${catErr.message}`);
        }

        // 2. Limpieza total de asignaciones previas
        const { error: delErr } = await supabase.from('category_assignments').delete().neq('category_type', 'X_INVALID_FORCE_DELETE');
        if (delErr) {
            console.warn("Delete warning (check RLS):", delErr);
            // Intentamos continuar incluso si el delete falla por RLS, aunque lo ideal es que el admin pueda borrar
        }
        
        // 3. Inserción de nuevas asignaciones
        const { error: insErr } = await supabase.from('category_assignments').insert(cleanAssignments);
        if (insErr) {
            console.error("Insert error details:", insErr);
            throw new Error(`Error de base de datos: ${insErr.message}. Asegúrate de haber ejecutado el script SQL para agregar la columna 'client_name'.`);
        }
    },

    addIndividualAssignment: async (type: string, concept: string, client: string, companies: string[]) => {
        if (!supabase) return;
        const rows = companies.map(cn => ({
            company_name: cn.trim(),
            category_type: type,
            category_name: concept.trim(),
            client_name: client.trim() || null
        }));
        const { error } = await supabase.from('category_assignments').insert(rows);
        if (error) throw error;
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
        const { error } = await supabase.from('budget_entries').upsert(payload, { onConflict: 'version_id,company_name,month,category_type,subcategory,client_name' });
        if (error) console.error("Upsert Entry Error:", error);
    },

    upsertRate: async (rate: ExchangeRate) => {
        if (!supabase) return;
        const payload = {
            company_name: rate.company.trim(),
            month: rate.month,
            year: rate.year,
            version_id: rate.versionId,
            plan_rate: rate.planRate,
            real_rate: rate.realRate
        };
        const { error } = await supabase.from('exchange_rates').upsert(payload, { onConflict: 'version_id,company_name,month' });
        if (error) console.error("Upsert Rate Error:", error);
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
        const { error } = await supabase.from('exchange_rates').upsert(payloads, { onConflict: 'version_id,company_name,month' });
        if (error) console.error("Bulk Upsert Rates Error:", error);
    },

    updateVersion: async (id: string, name: string, description: string) => {
        if (!supabase) return;
        const { error } = await supabase.from('budget_versions').update({ name: name.trim(), description }).eq('id', id);
        if (error) throw error;
    },
    createVersion: async (name: string, description: string) => {
        if (!supabase) return;
        const { error } = await supabase.from('budget_versions').insert({ name: name.trim(), description });
        if (error) throw error;
    },
    deleteVersion: async (id: string) => {
        if (!supabase) return;
        const { error } = await supabase.from('budget_versions').delete().eq('id', id);
        if (error) throw error;
    },
    cloneVersion: async (sourceVersionId: string, newName: string, newDescription: string) => {
        if (!supabase) return;
        const { error } = await supabase.rpc('clone_budget_version', { source_version_id: sourceVersionId, new_version_name: newName.trim(), new_description: newDescription });
        if (error) throw error;
    },
    updateCompany: async (oldName: string, newCompany: CompanyDetail) => {
        if(!supabase) return;
        const { error } = await supabase.from('companies').update({ name: newCompany.name.trim(), currency: newCompany.currency }).eq('name', oldName.trim());
        if (error) throw error;
    },
    addCompany: async (company: CompanyDetail) => {
        if(!supabase) return;
        const { error } = await supabase.from('companies').insert({ name: company.name.trim(), currency: company.currency });
        if (error) throw error;
    },
    deleteCompany: async (name: string) => {
        if(!supabase) return;
        const { error } = await supabase.from('companies').delete().eq('name', name.trim());
        if (error) throw error;
    },
    addCategory: async (type: string, name: string) => {
        if(!supabase) return;
        const { error } = await supabase.from('categories').upsert({ type, name: name.trim() }, { onConflict: 'type,name' });
        if (error) throw error;
    },
    updateCategory: async (type: string, oldName: string, newName: string) => {
        if (!supabase) return;
        const { error } = await supabase.from('categories').update({ name: newName.trim() }).match({ type, name: oldName.trim() });
        if (error) throw error;
    },
    deleteCategory: async (type: string, name: string) => {
        if(!supabase) return;
        const { error } = await supabase.from('categories').delete().match({ type, name: name.trim() });
        if (error) throw error;
    }
};