// Simple CSV -> data/values.json migrator
// Usage: node scripts/migrate_sheet_csv.js path/to/export.csv

const fs = require('fs');
const path = require('path');
const { writeFileSync } = fs;
const { readData, writeData } = require('../utils/db');

async function migrate(csvPath) {
  if (!fs.existsSync(csvPath)) {
    console.error('Fichier CSV introuvable:', csvPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(csvPath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const result = {};
  for (const line of lines) {
    // naive CSV split on comma - assumes no commas in fields
    const parts = line.split(',').map(s => s.trim());
    // expected: name,value,trend,updatedAt
    const name = (parts[0] || '').toLowerCase();
    const value = Number(parts[1]) || 0;
    const trend = parts[2] || 'stable';
    const updatedAt = parts[3] || null;
    if (!name) continue;
    result[name] = { value, trend, updatedAt };
  }

  // write as _global
  const allValues = readData('values.json', {});
  allValues['_global'] = result;
  writeData('values.json', allValues);
  console.log('Migration terminée. Écrit data/values.json with _global entries:', Object.keys(result).length);
}

if (require.main === module) {
  const csv = process.argv[2];
  if (!csv) {
    console.error('Usage: node scripts/migrate_sheet_csv.js path/to/export.csv');
    process.exit(1);
  }
  migrate(csv).catch(err => { console.error(err); process.exit(1); });
}
