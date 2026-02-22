
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
  client?: string; // New: Segment by client
  planValue: number; // Total ($)
  planUnits: number; // Q
  realValue: number; // Total ($)
  realUnits: number; // Q
  versionId: string;
  // Detail fields for future Grid Step
  operatorRate?: number;
  salePrice?: number;
  unitDirectCost?: number;
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
    clientName?: string; // New: Assignment now includes client
}

export interface AppConfig {
  companies: CompanyDetail[];
  categories: {
    [key in CategoryType]: string[];
  };
  assignments: CategoryAssignment[];
  clients: string[]; // New: List of clients
}

// --- Auth Types ---
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
