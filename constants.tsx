
import { Category } from './types';

export const CATEGORIES: Category[] = [
  { id: 'cereais', name: 'Cereais & Grãos', icon: '🌾' },
  { id: 'laticinios', name: 'Laticínios', icon: '🥛' },
  { id: 'limpeza', name: 'Limpeza', icon: '🧼' },
  { id: 'higiene', name: 'Higiene', icon: '🪥' },
  { id: 'bebidas', name: 'Bebidas', icon: '🥤' },
  { id: 'congelados', name: 'Congelados', icon: '❄️' },
  { id: 'outros', name: 'Outros', icon: '📦' },
];

export const UNITS = ['un', 'kg', 'l', 'g', 'ml', 'pacote', 'caixa'] as const;
