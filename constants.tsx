import { Category, Language, Unit } from './types';

export const CATEGORIES: Category[] = [
  { id: 'cereals_grains', name: 'Cereais & Grãos', icon: '🌾' },
  { id: 'fruits_vegetables', name: 'Frutas e Legumes', icon: '🥦' },
  { id: 'canned_goods', name: 'Enlatados', icon: '🥫' },
  { id: 'meat_fish', name: 'Carnes e Peixes', icon: '🥩' },
  { id: 'bakery', name: 'Padaria', icon: '🥖' },
  { id: 'cooking_baking', name: 'Culinária e Confeitaria', icon: '🧁' },
  { id: 'sweets_savory_snacks', name: 'Doces e Salgados', icon: '🍫' },
  { id: 'dairy', name: 'Laticínios', icon: '🥛' },
  { id: 'cleaning', name: 'Limpeza', icon: '🧼' },
  { id: 'hygiene', name: 'Higiene', icon: '🪥' },
  { id: 'beverages', name: 'Bebidas', icon: '🥤' },
  { id: 'frozen', name: 'Congelados', icon: '❄️' },
  { id: 'others', name: 'Outros', icon: '📦' },
];

export const UNITS: Unit[] = ['un', 'kg', 'l', 'g', 'ml', 'package', 'box'];

const CATEGORY_LABELS: Record<Language, Record<string, string>> = {
  pt: {
    cereals_grains: 'Cereais & Grãos',
    fruits_vegetables: 'Frutas e Legumes',
    canned_goods: 'Enlatados',
    meat_fish: 'Carnes e Peixes',
    bakery: 'Padaria',
    cooking_baking: 'Culinária e Confeitaria',
    sweets_savory_snacks: 'Doces e Salgados',
    dairy: 'Laticínios',
    cleaning: 'Limpeza',
    hygiene: 'Higiene',
    beverages: 'Bebidas',
    frozen: 'Congelados',
    others: 'Outros',
  },
  en: {
    cereals_grains: 'Cereals & Grains',
    fruits_vegetables: 'Fruits & Vegetables',
    canned_goods: 'Canned Goods',
    meat_fish: 'Meat & Fish',
    bakery: 'Bakery',
    cooking_baking: 'Cooking & Baking',
    sweets_savory_snacks: 'Sweets & Savory Snacks',
    dairy: 'Dairy',
    cleaning: 'Cleaning',
    hygiene: 'Hygiene',
    beverages: 'Beverages',
    frozen: 'Frozen',
    others: 'Others',
  },
};

const UNIT_LABELS: Record<Language, Record<Unit, string>> = {
  pt: {
    un: 'un',
    kg: 'kg',
    l: 'l',
    g: 'g',
    ml: 'ml',
    package: 'pacote',
    box: 'caixa',
  },
  en: {
    un: 'unit',
    kg: 'kg',
    l: 'l',
    g: 'g',
    ml: 'ml',
    package: 'package',
    box: 'box',
  },
};


export const normalizeUnitId = (rawUnit: unknown): Unit => {
  const normalized = String(rawUnit || '').trim().toLowerCase();
  if (normalized === 'pacote') return 'package';
  if (normalized === 'caixa') return 'box';
  if (UNITS.includes(normalized as Unit)) return normalized as Unit;
  return 'un';
};

export const getCategoryLabel = (categoryId: string, lang: Language) => {
  return CATEGORY_LABELS[lang][categoryId] || CATEGORY_LABELS[lang].others;
};

export const getUnitLabel = (unit: unknown, lang: Language) => {
  const normalizedUnit = normalizeUnitId(unit);
  return UNIT_LABELS[lang][normalizedUnit] || normalizedUnit;
};
