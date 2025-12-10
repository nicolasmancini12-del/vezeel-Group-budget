
import { BudgetVersion, BudgetEntry, AppConfig, ExchangeRate } from './types';

export const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const CONSOLIDATED_ID = 'CONSOLIDATED_VIEW';
export const CONSOLIDATED_NAME = 'GRUPO VEZEEL (Consolidado USD)';

export const DEFAULT_CONFIG: AppConfig = {
  companies: [
    { id: 'vezeel-sales', name: 'Vezeel Sales', currency: 'USD' },
    { id: 'vezeel-tech', name: 'Vezeel Tech', currency: 'ARS' },
    { id: 'vezeel-consulting', name: 'Vezeel Consulting', currency: 'MXN' }
  ],
  categories: {
    'Ingresos': ['Servicio A (Consultoría)', 'Servicio B (Implementación)', 'Licencias SaaS'],
    'Costos Directos': ['Freelancers', 'Servidores / Nube', 'Licencias de Terceros'],
    'Costos Indirectos': ['Comercial', 'Operativo', 'Marketing', 'RRHH', 'Oficina']
  }
};

export const INITIAL_VERSIONS: BudgetVersion[] = [
  {
    id: 'v1',
    name: 'Presupuesto Base 2026',
    description: 'Versión aprobada por directorio en Dic 2025',
    isActive: true,
    createdAt: '2025-12-15'
  },
  {
    id: 'v2',
    name: 'Escenario Optimista',
    description: 'Proyección con crecimiento del 20%',
    isActive: false,
    createdAt: '2026-01-10'
  }
];

// Helper to generate a UUID-like string
export const generateId = () => Math.random().toString(36).substr(2, 9);

export const generateInitialEntries = (): BudgetEntry[] => {
  const entries: BudgetEntry[] = [];
  
  // Data for Vezeel Sales (USD)
  [1, 2, 3].forEach(month => {
    entries.push({
      id: generateId(),
      month,
      year: 2026,
      company: 'Vezeel Sales',
      category: 'Ingresos',
      subCategory: 'Servicio A (Consultoría)',
      planValue: 15000,
      planUnits: 10,
      realValue: month === 1 ? 14500 : 0,
      realUnits: month === 1 ? 9 : 0,
      versionId: 'v1'
    });
  });

  // Data for Vezeel Tech (ARS - Local Currency)
  // Assuming 1 USD = 1000 ARS for example
  [1, 2, 3].forEach(month => {
    entries.push({
      id: generateId(),
      month,
      year: 2026,
      company: 'Vezeel Tech',
      category: 'Ingresos',
      subCategory: 'Licencias SaaS',
      planValue: 5000000, // 5M ARS (~5000 USD)
      planUnits: 50,
      realValue: month === 1 ? 5200000 : 0,
      realUnits: month === 1 ? 52 : 0,
      versionId: 'v1'
    });
  });

  return entries;
};

export const generateInitialRates = (): ExchangeRate[] => {
  const rates: ExchangeRate[] = [];
  
  // Initialize rates for ARS and MXN companies
  // Sales is USD, so rate is 1 (implicit)
  
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].forEach(month => {
    // Vezeel Tech (ARS)
    rates.push({
      id: generateId(),
      company: 'Vezeel Tech',
      month,
      year: 2026,
      versionId: 'v1',
      planRate: 1000 + (month * 20), // Slight devaluation projection
      realRate: month === 1 ? 1050 : 0
    });

    // Vezeel Consulting (MXN)
    rates.push({
      id: generateId(),
      company: 'Vezeel Consulting',
      month,
      year: 2026,
      versionId: 'v1',
      planRate: 18,
      realRate: month === 1 ? 17.5 : 0
    });
  });

  return rates;
}
