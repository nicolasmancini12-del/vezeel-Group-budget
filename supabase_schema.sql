-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla de Empresas
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Categorías Maestras
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, 
    name TEXT NOT NULL,
    UNIQUE(type, name)
);

-- 4. Tabla de Asignaciones
CREATE TABLE IF NOT EXISTS category_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT REFERENCES companies(name) ON UPDATE CASCADE,
    category_type TEXT NOT NULL,
    category_name TEXT NOT NULL,
    client_name TEXT NOT NULL DEFAULT '', 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabla de Versiones
CREATE TABLE IF NOT EXISTS budget_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tabla de Entradas de Presupuesto
CREATE TABLE IF NOT EXISTS budget_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID REFERENCES budget_versions(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    category_type TEXT NOT NULL,
    subcategory TEXT NOT NULL,
    client_name TEXT NOT NULL DEFAULT '',
    plan_value NUMERIC DEFAULT 0,
    plan_units NUMERIC DEFAULT 0,
    real_value NUMERIC DEFAULT 0,
    real_units NUMERIC DEFAULT 0,
    operator_rate NUMERIC,
    sale_price NUMERIC DEFAULT 0, -- Master Price Plan
    unit_direct_cost NUMERIC DEFAULT 0, -- Master Cost Plan
    real_sale_price NUMERIC DEFAULT 0, -- Master Price Real
    real_unit_direct_cost NUMERIC DEFAULT 0, -- Master Cost Real
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(version_id, company_name, month, category_type, subcategory, client_name)
);

-- 7. Tabla de Tasas de Cambio
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID REFERENCES budget_versions(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    plan_rate NUMERIC DEFAULT 1,
    real_rate NUMERIC DEFAULT 1,
    UNIQUE(version_id, company_name, month)
);