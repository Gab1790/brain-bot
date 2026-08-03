const fs = require('fs');
const path = require('path');
const { writeData } = require('../utils/db');

const dataDir = process.env.BRAINBOT_DATA_DIR
  ? path.resolve(process.env.BRAINBOT_DATA_DIR)
  : path.join(__dirname, '..', 'data');

function migrate() {
  if (!fs.existsSync(dataDir)) {
    console.log(`No data directory found at ${dataDir}`);
    return;
  }

  const files = fs.readdirSync(dataDir).filter(name => name.endsWith('.json'));
  for (const fileName of files) {
    const fullPath = path.join(dataDir, fileName);
    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      writeData(fileName, parsed);
      console.log(`Migrated ${fileName}`);
    } catch (err) {
      console.warn(`Skipped ${fileName}: ${err.message}`);
    }
  }
}

migrate();
