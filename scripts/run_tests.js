const assert = require('assert');
const { readData, writeData } = require('../utils/db');
const { getGlobalAverage } = require('../utils/sheetValues');
const { levenshtein, bestMatch } = require('../utils/fuzzy');

function testLevenshtein() {
  assert.strictEqual(levenshtein('kitten', 'sitting'), 3);
  assert.strictEqual(levenshtein('rofl', 'rofl'), 0);
  console.log('levenshtein: OK');
}

function testBestMatch() {
  const candidates = ['apple', 'banana', 'orange', 'rotten apple'];
  const bm = bestMatch('appl', candidates, 2);
  assert.strictEqual(bm, 'apple');
  console.log('bestMatch: OK');
}

function testGlobalAverage() {
  // prepare temporary values
  const orig = readData('values.json', {});
  const backup = JSON.parse(JSON.stringify(orig));
  try {
    const sample = { '_global': { 'a': { value: 100 }, 'b': { value: 300 } } };
    writeData('values.json', sample);
    const avg = getGlobalAverage(null);
    assert.strictEqual(avg, 200);
    console.log('getGlobalAverage: OK');
  } finally {
    writeData('values.json', backup);
  }
}

async function runAll() {
  testLevenshtein();
  testBestMatch();
  testGlobalAverage();
  console.log('All tests passed');
}

runAll().catch(err => { console.error('Tests failed', err); process.exit(1); });