
export type CategoryType = 'Ingresos' | 'Costos Directos' | 'Costos Indirectos';

export const CATEGORY_TYPES: CategoryType[] = ['Ingresos', 'Costos Directos', 'Costos Indirectos'];

export interface CompanyDetail {
  id: string; // Unique ID (usually the name sanitized, or UUID)
  name: string;
  currency: string; // 'USD', 'ARS', 'MXN', 'EUR', etc.
}

export interface BudgetEntry {
  id: string;
  month: number; // 1-12
  year: number;
  company: string; // References CompanyDetail.name
  category: CategoryType;
  subCategory: string; 
  planValue: number; // In Local Currency
  planUnits: number;
  realValue: number; // In Local Currency
  realUnits: number;
  versionId: string;
}

export interface ExchangeRate {
  id: string;
  company: string; // References CompanyDetail.name
  month: number;
  year: number;
  versionId: string;
  planRate: number; // Local Currency per 1 USD
  realRate: number;
}

export interface BudgetVersion {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export interface AppConfig {
  companies: CompanyDetail[];
  categories: {
    [key in CategoryType]: string[];
  };
}
