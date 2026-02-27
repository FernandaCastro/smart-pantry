import { TranslationKey, translate } from './i18n';
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

const toCategoryKey = (categoryId: string): TranslationKey => (`category.${categoryId}` as TranslationKey);
const toUnitKey = (unit: Unit): TranslationKey => (`unit.${unit}` as TranslationKey);

export const normalizeUnitId = (rawUnit: unknown): Unit => {
  const normalized = String(rawUnit || '').trim().toLowerCase();
  if (normalized === 'pacote') return 'package';
  if (normalized === 'caixa') return 'box';
  if (UNITS.includes(normalized as Unit)) return normalized as Unit;
  return 'un';
};

export const getCategoryLabel = (categoryId: string, lang: Language) => {
  const key = toCategoryKey(categoryId);
  return translate(lang, key) || translate(lang, 'category.others');
};

export const getUnitLabel = (unit: unknown, lang: Language) => {
  const normalizedUnit = normalizeUnitId(unit);
  return translate(lang, toUnitKey(normalizedUnit));
};
