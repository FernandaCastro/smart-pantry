import { Product, Unit } from './types';
import { CATEGORIES, UNITS } from './constants';

export type VoiceIntent = 'consume' | 'add';

export const normalizeText = (value: string) => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const singularizeToken = (token: string) => {
  if (token.endsWith('zes') && token.length > 4) return `${token.slice(0, -3)}z`;
  if (token.endsWith('tes') && token.length > 4) return token.slice(0, -1);
  if (token.endsWith('es') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && token.length > 3) return token.slice(0, -1);
  return token;
};

const tokenize = (value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized
    .split(' ')
    .filter(Boolean)
    .map(singularizeToken);
};

const tokenOverlap = (a: string[], b: string[]) => {
  if (!a.length || !b.length) return 0;
  const aSet = new Set(a);
  const bSet = new Set(b);
  const intersection = [...aSet].filter(token => bSet.has(token)).length;
  const union = new Set([...aSet, ...bSet]).size;
  return union > 0 ? intersection / union : 0;
};


const tokenCoverage = (source: string[], target: string[]) => {
  if (!source.length || !target.length) return 0;
  const sourceSet = new Set(source);
  const targetSet = new Set(target);
  const intersection = [...targetSet].filter(token => sourceSet.has(token)).length;
  return intersection / targetSet.size;
};


const NON_PRODUCT_TOKENS = new Set([
  'adicionar', 'adicione', 'adiciona', 'adicione', 'consumir', 'consuma', 'consome',
  'remover', 'remove', 'retirar', 'retire', 'usar', 'use', 'comprar', 'compre',
  'i', 'you', 'me', 'my', 'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da',
  'dos', 'das', 'no', 'na', 'nos', 'nas', 'para', 'por', 'com', 'sem', 'e', 'ou', 'mais',
  'menos', 'que', 'what', 'please', 'porfavor', 'favor'
]);

const singularizeWord = (word: string) => {
  const normalized = normalizeText(word);
  if (!normalized || NON_PRODUCT_TOKENS.has(normalized)) return normalized;

  if (normalized.endsWith('zes') && normalized.length > 4) return `${normalized.slice(0, -3)}z`;
  if (normalized.endsWith('tes') && normalized.length > 4) return normalized.slice(0, -1);
  if (normalized.endsWith('es') && normalized.length > 4) return normalized.slice(0, -2);
  if (normalized.endsWith('s') && normalized.length > 3) return normalized.slice(0, -1);
  return normalized;
};

export const normalizeVoiceTranscriptToSingular = (transcript: string) => {
  if (!transcript?.trim()) return '';

  return transcript
    .split(/\s+/)
    .map(singularizeWord)
    .filter(Boolean)
    .join(' ')
    .trim();
};

export const inferVoiceIntent = (args: any): VoiceIntent | null => {
  const rawIntent = String(args?.intent || args?.action || '').toLowerCase();
  if (['consume', 'consumir', 'consumi', 'remove', 'retirar', 'usar', 'used'].includes(rawIntent)) return 'consume';
  if (['add', 'adicionar', 'adicionei', 'inserir', 'insert', 'comprar', 'bought'].includes(rawIntent)) return 'add';
  return null;
};

export const normalizeVoiceUnit = (rawUnit: unknown): Unit => {
  const normalized = normalizeText(String(rawUnit || ''));
  const unitAliases: Record<string, Unit> = {
    unidade: 'un',
    unidades: 'un',
    unit: 'un',
    units: 'un',
    litro: 'l',
    litros: 'l',
    lt: 'l',
    kilo: 'kg',
    kilos: 'kg',
    quilo: 'kg',
    quilos: 'kg',
    grama: 'g',
    gramas: 'g',
    mililitro: 'ml',
    mililitros: 'ml',
    pack: 'package',
    package: 'package',
    pacote: 'package',
    pacotes: 'package',
    box: 'box',
    caixas: 'box'
  };

  const aliasMatch = unitAliases[normalized];
  if (aliasMatch) return aliasMatch;

  const validUnit = UNITS.find(unit => unit === normalized);
  return (validUnit || 'un') as Unit;
};

export const normalizeVoiceCategory = (rawCategory: unknown) => {
  const normalized = normalizeText(String(rawCategory || ''));
  if (!normalized) return 'others';

  const categoryAliases: Record<string, string> = {
    cereal: 'cereals_grains',
    cereais: 'cereals_grains',
    grao: 'cereals_grains',
    graos: 'cereals_grains',
    'graos e cereais': 'cereals_grains',
    fruta: 'fruits_vegetables',
    frutas: 'fruits_vegetables',
    legume: 'fruits_vegetables',
    legumes: 'fruits_vegetables',
    'frutas e legumes': 'fruits_vegetables',
    enlatado: 'canned_goods',
    enlatados: 'canned_goods',
    carne: 'meat_fish',
    carnes: 'meat_fish',
    peixe: 'meat_fish',
    peixes: 'meat_fish',
    'carnes e peixes': 'meat_fish',
    padaria: 'bakery',
    bakery: 'bakery',
    culinaria: 'cooking_baking',
    confeitaria: 'cooking_baking',
    'culinaria e confeitaria': 'cooking_baking',
    doce: 'sweets_savory_snacks',
    doces: 'sweets_savory_snacks',
    salgado: 'sweets_savory_snacks',
    salgados: 'sweets_savory_snacks',
    'doces e salgados': 'sweets_savory_snacks',
    laticinio: 'dairy',
    laticinios: 'dairy',
    dairy: 'dairy',
    bebida: 'beverages',
    bebidas: 'beverages',
    drink: 'beverages',
    drinks: 'beverages',
    limpeza: 'cleaning',
    hygiene: 'hygiene',
    higiene: 'hygiene',
    congelado: 'frozen',
    congelados: 'frozen',
    frozen: 'frozen',
    outros: 'others',
    outro: 'others'
  };

  if (categoryAliases[normalized]) return categoryAliases[normalized];

  const validCategory = CATEGORIES.find(category => normalizeText(category.id) === normalized || normalizeText(category.name) === normalized);
  return validCategory?.id || 'others';
};

export const findBestPantryItemByName = (items: Product[], productName: string) => {
  const query = normalizeText(productName);
  if (!query) return null;

  let best: { item: Product; score: number } | null = null;

  for (const item of items) {
    const itemName = normalizeText(item.name);
    if (!itemName) continue;

    let score = 0;

    if (itemName === query) {
      score = 1;
    } else if (itemName.startsWith(query) || query.startsWith(itemName)) {
      score = 0.9;
    } else if (itemName.includes(query) || query.includes(itemName)) {
      score = 0.8;
    } else {
      const itemTokens = tokenize(itemName);
      const queryTokens = tokenize(query);
      const overlap = tokenOverlap(itemTokens, queryTokens);
      const coverage = tokenCoverage(itemTokens, queryTokens);
      score = Math.max(overlap * 0.75, coverage * 0.7);
    }

    if (!best || score > best.score) {
      best = { item, score };
    }
  }

  if (!best || best.score < 0.45) return null;
  return best.item;
};
