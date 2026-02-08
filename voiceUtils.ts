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
    pack: 'pacote',
    pacote: 'pacote',
    pacotes: 'pacote',
    box: 'caixa',
    caixas: 'caixa'
  };

  const aliasMatch = unitAliases[normalized];
  if (aliasMatch) return aliasMatch;

  const validUnit = UNITS.find(unit => unit === normalized);
  return (validUnit || 'un') as Unit;
};

export const normalizeVoiceCategory = (rawCategory: unknown) => {
  const normalized = normalizeText(String(rawCategory || ''));
  if (!normalized) return 'outros';

  const categoryAliases: Record<string, string> = {
    cereal: 'cereais',
    cereais: 'cereais',
    grao: 'cereais',
    graos: 'cereais',
    'graos e cereais': 'cereais',
    laticinio: 'laticinios',
    laticinios: 'laticinios',
    dairy: 'laticinios',
    bebida: 'bebidas',
    bebidas: 'bebidas',
    drink: 'bebidas',
    drinks: 'bebidas',
    limpeza: 'limpeza',
    hygiene: 'higiene',
    higiene: 'higiene',
    congelado: 'congelados',
    congelados: 'congelados',
    frozen: 'congelados',
    outros: 'outros',
    outro: 'outros'
  };

  if (categoryAliases[normalized]) return categoryAliases[normalized];

  const validCategory = CATEGORIES.find(category => normalizeText(category.id) === normalized || normalizeText(category.name) === normalized);
  return validCategory?.id || 'outros';
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
