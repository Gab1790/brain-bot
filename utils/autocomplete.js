const { getSheetValues } = require('./sheetValues');
const { searchBrainrots } = require('./fandomApi');
const { bestMatch } = require('./fuzzy');

async function handleBrainrotAutocomplete(interaction, allowComma = false) {
  try {
    const focused = interaction.options.getFocused();
    const guildId = interaction.guildId;
    const values = await getSheetValues(guildId);
    const keys = Object.keys(values || {});

    // If the user input looks like a monetary amount (only digits, currency symbols, dots, commas, spaces), do not suggest
    const moneyPattern = /^[\d\s.,€$£¥₹+-]+$/;
    if (moneyPattern.test(focused.trim())) {
      return interaction.respond([]);
    }

    let lastToken = focused.trim().toLowerCase();
    let prefix = '';

    if (allowComma) {
      // support comma-separated partial input: consider last token
      const parts = focused.split(',');
      const lastTokenRaw = parts.pop() || '';
      lastToken = lastTokenRaw.trim().toLowerCase();
      prefix = parts.length > 0 ? parts.join(',') + ', ' : '';
    }

    if (!lastToken && !allowComma) {
      return interaction.respond([]);
    }

    const suggestions = [];
    
    // 1. Exact or partial match in local keys
    for (const k of keys) {
      if (k.toLowerCase().includes(lastToken)) {
        suggestions.push({ name: k, value: prefix + k });
        if (suggestions.length >= 25) break;
      }
    }

    // 2. Fandom Wiki Search for "brainrots"
    if (suggestions.length < 25 && lastToken.length > 1) {
      try {
        const fandomResults = await searchBrainrots(lastToken);
        for (const res of fandomResults) {
          if (!suggestions.find(s => s.name.toLowerCase() === res.toLowerCase())) {
            suggestions.push({ name: res, value: prefix + res });
            if (suggestions.length >= 25) break;
          }
        }
      } catch (e) {}
    }

    // 3. Fuzzy match on local keys if still nothing/little found
    if (suggestions.length < 25 && lastToken.length > 1) {
      try {
        const fuzzy = bestMatch(lastToken, keys, 5);
        if (fuzzy && !suggestions.find(s => s.name.toLowerCase() === fuzzy.toLowerCase())) {
          suggestions.push({ name: fuzzy, value: prefix + fuzzy });
        }
      } catch (e) {}
    }

    await interaction.respond(suggestions.slice(0, 25));
  } catch (err) {
    console.error('Autocomplete error', err);
    await interaction.respond([]);
  }
}

module.exports = { handleBrainrotAutocomplete };
