
import { createClient } from '@supabase/supabase-js';
import { AppConfig, BudgetEntry, CompanyDetail, ExchangeRate, BudgetVersion, CategoryType } from '../types';
import { DEFAULT_CONFIG } from '../constants';

// --- CONFIGURACIÓN ---
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// --- MAPEOS (Frontend <-> Database) ---
// Convertimos snake_case (DB) a camelCase (App) y viceversa

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
    // 1. Obtener Configuración Inicial (Empresas y Categorías)
    fetchConfig: async (): Promise<AppConfig | null> => {
        if (!supabase) return null;
        
        try {
            // Get Companies
            const { data: companies, error: errCo } = await supabase.from('companies').select('*');
            if (errCo) throw errCo;

            // Get Categories
            const { data: categories, error: errCat } = await supabase.from('categories').select('*');
            if (errCat) throw errCat;

            // Reconstruct AppConfig structure
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

    // 2. Obtener Datos del Presupuesto (Entradas y Tasas)
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

    // 3. Obtener Versiones
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

    // --- WRITE OPERATIONS ---

    // Upsert (Insert or Update) Budget Entry
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

        // We try to find if it exists by logic ID or let Supabase handle if we had a unique constraint.
        // Since our UI generates random IDs for new cells, but the DB has its own UUIDs,
        // we rely on the composite unique key logic or simple update.
        // For simplicity in this No-Code friendly version, we delete matches and insert (naive upsert)
        // OR we use the ID if it's a UUID from DB. 
        
        // Better approach: Match by business keys
        const { data, error } = await supabase.from('budget_entries').select('id').match({
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

    // Upsert Exchange Rate
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

    // Config ABM
    addCompany: async (company: CompanyDetail) => {
        if(!supabase) return;
        await supabase.from('companies').insert({ name: company.name, currency: company.currency });
    },
    
    updateCompany: async (oldName: string, newCompany: CompanyDetail) => {
        if(!supabase) return;
        // 1. Update Company Table
        await supabase.from('companies').update({ name: newCompany.name, currency: newCompany.currency }).eq('name', oldName);
        
        // 2. Cascade update entries (Manual cascade since we used text keys for simplicity)
        await supabase.from('budget_entries').update({ company_name: newCompany.name }).eq('company_name', oldName);
        await supabase.from('exchange_rates').update({ company_name: newCompany.name }).eq('company_name', oldName);
    },

    deleteCompany: async (name: string) => {
        if(!supabase) return;
        await supabase.from('companies').delete().eq('name', name);
        // Cascade delete happens via entries logic or manually
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
        // Clean up entries
        await supabase.from('budget_entries').delete().match({ category_type: type, subcategory: name });
    },
    
    updateCategory: async (type: string, oldName: string, newName: string) => {
        if(!supabase) return;
        await supabase.from('categories').update({ name: newName }).match({ type, name: oldName });
        await supabase.from('budget_entries').update({ subcategory: newName }).match({ category_type: type, subcategory: oldName });
    }
};
