import { Category, Language, Unit } from './types';

export const CATEGORIES: Category[] = [
  { id: 'cereais', name: 'Cereais & Grãos', icon: '🌾' },
  { id: 'laticinios', name: 'Laticínios', icon: '🥛' },
  { id: 'limpeza', name: 'Limpeza', icon: '🧼' },
  { id: 'higiene', name: 'Higiene', icon: '🪥' },
  { id: 'bebidas', name: 'Bebidas', icon: '🥤' },
  { id: 'congelados', name: 'Congelados', icon: '❄️' },
  { id: 'outros', name: 'Outros', icon: '📦' },
];

export const UNITS: Unit[] = ['un', 'kg', 'l', 'g', 'ml', 'package', 'box'];

const CATEGORY_LABELS: Record<Language, Record<string, string>> = {
  pt: {
    cereais: 'Cereais & Grãos',
    laticinios: 'Laticínios',
    limpeza: 'Limpeza',
    higiene: 'Higiene',
    bebidas: 'Bebidas',
    congelados: 'Congelados',
    outros: 'Outros',
  },
  en: {
    cereais: 'Cereals & Grains',
    laticinios: 'Dairy',
    limpeza: 'Cleaning',
    higiene: 'Hygiene',
    bebidas: 'Beverages',
    congelados: 'Frozen',
    outros: 'Others',
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
  return CATEGORY_LABELS[lang][categoryId] || CATEGORY_LABELS[lang].outros;
};

export const getUnitLabel = (unit: unknown, lang: Language) => {
  const normalizedUnit = normalizeUnitId(unit);
  return UNIT_LABELS[lang][normalizedUnit] || normalizedUnit;
};
