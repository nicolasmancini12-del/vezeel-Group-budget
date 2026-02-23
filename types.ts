
export type CategoryType = 'Ingresos' | 'Costos Directos' | 'Costos Indirectos';

export const CATEGORY_TYPES: CategoryType[] = ['Ingresos', 'Costos Directos', 'Costos Indirectos'];

export interface CompanyDetail {
  id: string; 
  name: string;
  currency: string; 
}

export interface BudgetEntry {
  id: string;
  month: number; // 1-12
  year: number;
  company: string; 
  category: CategoryType;
  subCategory: string; 
  client?: string; 
  planValue: number; // Total Plan ($)
  planUnits: number; // Q Plan
  realValue: number; // Total Real ($)
  realUnits: number; // Q Real
  versionId: string;
  operatorRate?: number;
  salePrice?: number; // Master Price Plan
  unitDirectCost?: number; // Master Cost Plan
  realSalePrice?: number; // Master Price Real (NEW)
  realUnitDirectCost?: number; // Master Cost Real (NEW)
}

export interface ExchangeRate {
  id: string;
  company: string;
  month: number;
  year: number;
  versionId: string;
  planRate: number;
  realRate: number;
}

export interface BudgetVersion {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export interface CategoryAssignment {
    companyName: string;
    categoryType: string;
    categoryName: string;
    clientName?: string;
}

export interface AppConfig {
  companies: CompanyDetail[];
  categories: {
    [key in CategoryType]: string[];
  };
  assignments: CategoryAssignment[];
  clients: string[];
}

export type UserRole = 'ADMIN' | 'USER';

export interface AppUser {
  id: string;
  email: string;
  password?: string; 
  name: string;
  role: UserRole;
}

export interface AccessLog {
  id: string;
  userEmail: string;
  action: string;
  details: string;
  timestamp: string;
}