const { getSheetValues, getGlobalAverage } = require('../utils/sheetValues');
const { readData } = require('../utils/db');

(async () => {
  console.log('Running basic checks...');
  const guildId = 'testguild';
  const vals = await getSheetValues(guildId);
  console.log('Values keys:', Object.keys(vals));
  console.log('Global average:', getGlobalAverage(guildId));
  const trades = readData('trades.json', {});
  console.log('Trades loaded:', Object.keys(trades).length);
  console.log('All good (manual verification recommended).');
})();