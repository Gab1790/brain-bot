const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brainbot-trade-'));
process.env.BRAINBOT_DATA_DIR = tempDir;

const { readData, writeData } = require('../utils/db');
const { getSheetValues, getGlobalAverage, invalidateCache } = require('../utils/sheetValues');
const { levenshtein, bestMatch } = require('../utils/fuzzy');

test('persists and reads JSON payloads through the storage layer', () => {
  const payload = { hello: 'world', nested: { count: 2 } };
  writeData('sample.json', payload);
  assert.deepStrictEqual(readData('sample.json', {}), payload);
});

test('migrates a legacy JSON file into the sqlite-backed store', () => {
  const legacyPath = path.join(tempDir, 'legacy.json');
  fs.writeFileSync(legacyPath, JSON.stringify({ legacy: true }, null, 2));
  assert.deepStrictEqual(readData('legacy.json', {}), { legacy: true });
});

test('computes global averages from stored values', async () => {
  const sample = { _global: { apple: { value: 100 }, banana: { value: 300 } } };
  writeData('values.json', sample);
  invalidateCache(null);
  assert.strictEqual(getGlobalAverage(null), 200);
  assert.deepStrictEqual(await getSheetValues(null), sample._global);
});

test('fuzzy matching prefers the closest known item', () => {
  assert.strictEqual(levenshtein('kitten', 'sitting'), 3);
  assert.strictEqual(bestMatch('appl', ['apple', 'banana', 'orange'], 2), 'apple');
});
