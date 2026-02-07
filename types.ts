
export type Unit = 'un' | 'kg' | 'l' | 'g' | 'ml' | 'pacote' | 'caixa';

export interface Product {
  id: string;
  name: string;
  category: string;
  currentQuantity: number;
  minQuantity: number;
  unit: Unit;
  updatedAt: number;
}

export interface ShoppingItem extends Product {
  neededQuantity: number;
}

export type ViewType = 'dashboard' | 'pantry' | 'shopping' | 'settings' | 'ai' | 'auth';

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  pantryId: string;
}

export interface PantryData {
  ownerId: string;
  collaborators: string[]; // List of user emails
  items: Product[];
}

export type Language = 'pt' | 'en';
