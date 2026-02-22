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
    type TEXT NOT NULL, -- 'Ingresos', 'Costos Directos', etc.
    name TEXT NOT NULL,
    UNIQUE(type, name)
);

-- 4. Tabla de Asignaciones (ABM de conceptos por empresa)
CREATE TABLE IF NOT EXISTS category_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT REFERENCES companies(name) ON UPDATE CASCADE,
    category_type TEXT NOT NULL,
    category_name TEXT NOT NULL,
    client_name TEXT, -- COLUMNA CRÍTICA FALTANTE
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
    client_name TEXT, -- COLUMNA CRÍTICA FALTANTE
    plan_value NUMERIC DEFAULT 0,
    plan_units NUMERIC DEFAULT 0,
    real_value NUMERIC DEFAULT 0,
    real_units NUMERIC DEFAULT 0,
    operator_rate NUMERIC,
    sale_price NUMERIC,
    unit_direct_cost NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- LLAVE ÚNICA ACTUALIZADA PARA INCLUIR CLIENTE
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

-- SCRIPT DE REPARACIÓN (EJECUTAR SI LAS TABLAS YA EXISTEN)
-- ALTER TABLE category_assignments ADD COLUMN IF NOT EXISTS client_name TEXT;
-- ALTER TABLE budget_entries ADD COLUMN IF NOT EXISTS client_name TEXT;
-- ALTER TABLE budget_entries DROP CONSTRAINT IF EXISTS budget_entries_version_id_company_name_month_category_ty_key;
-- ALTER TABLE budget_entries ADD CONSTRAINT budget_entries_unique_identity UNIQUE(version_id, company_name, month, category_type, subcategory, client_name);
