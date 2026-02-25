import test from 'node:test';
import assert from 'node:assert/strict';
import { findBestPantryItemByName, inferVoiceIntent, normalizeVoiceCategory, normalizeVoiceTranscriptToSingular, normalizeVoiceUnit } from '../.tmp/voiceUtils.bundle.mjs';

const pantry = [
  { id: '1', name: 'Leite Integral', category: 'dairy', currentQuantity: 2, minQuantity: 1, unit: 'l', updatedAt: Date.now() },
  { id: '2', name: 'Arroz Branco', category: 'cereals_grains', currentQuantity: 1, minQuantity: 1, unit: 'kg', updatedAt: Date.now() },
  { id: '3', name: 'Detergente Neutro', category: 'cleaning', currentQuantity: 1, minQuantity: 1, unit: 'un', updatedAt: Date.now() }
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
  assert.equal(normalizeVoiceCategory('laticínios'), 'dairy');
  assert.equal(normalizeVoiceCategory('Frutas e Legumes'), 'fruits_vegetables');
  assert.equal(normalizeVoiceCategory('doces'), 'sweets_savory_snacks');
  assert.equal(normalizeVoiceCategory(undefined), 'others');
});


test('normalizeVoiceTranscriptToSingular standardizes product tokens to singular', () => {
  assert.equal(
    normalizeVoiceTranscriptToSingular('Adicionar 2 bananas e 3 tomates, por favor'),
    'adicionar 2 banana e 3 tomate por favor'
  );
});


test('normalizeVoiceTranscriptToSingular preserves quantity words', () => {
  assert.equal(normalizeVoiceTranscriptToSingular('adicionar seis laranjas'), 'adicionar seis laranja');
  assert.equal(normalizeVoiceTranscriptToSingular('adicionar duas laranjas'), 'adicionar duas laranja');
  assert.equal(normalizeVoiceTranscriptToSingular('adicionar tres laranjas'), 'adicionar tres laranja');
});
