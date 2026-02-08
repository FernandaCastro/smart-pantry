import test from 'node:test';
import assert from 'node:assert/strict';
import { findBestPantryItemByName, inferVoiceIntent, normalizeVoiceCategory, normalizeVoiceUnit } from '../.tmp/voiceUtils.bundle.mjs';

const pantry = [
  { id: '1', name: 'Leite Integral', category: 'laticinios', currentQuantity: 2, minQuantity: 1, unit: 'l', updatedAt: Date.now() },
  { id: '2', name: 'Arroz Branco', category: 'cereais', currentQuantity: 1, minQuantity: 1, unit: 'kg', updatedAt: Date.now() },
  { id: '3', name: 'Detergente Neutro', category: 'limpeza', currentQuantity: 1, minQuantity: 1, unit: 'un', updatedAt: Date.now() }
];

test('findBestPantryItemByName finds accents/plural variations', () => {
  const milk = findBestPantryItemByName(pantry, 'leites');
  assert.equal(milk?.id, '1');

  const rice = findBestPantryItemByName(pantry, 'arrozes');
  assert.equal(rice?.id, '2');
});

test('findBestPantryItemByName returns null for weak match', () => {
  const unknown = findBestPantryItemByName(pantry, 'shampoo');
  assert.equal(unknown, null);
});

test('inferVoiceIntent handles pt/en aliases', () => {
  assert.equal(inferVoiceIntent({ intent: 'consumir' }), 'consume');
  assert.equal(inferVoiceIntent({ action: 'bought' }), 'add');
  assert.equal(inferVoiceIntent({ intent: 'unknown' }), null);
});

test('normalizeVoiceUnit and normalizeVoiceCategory map aliases safely', () => {
  assert.equal(normalizeVoiceUnit('litros'), 'l');
  assert.equal(normalizeVoiceUnit('boxes'), 'un');
  assert.equal(normalizeVoiceCategory('laticínios'), 'laticinios');
  assert.equal(normalizeVoiceCategory(undefined), 'outros');
});
