const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readData } = require('../utils/db');

function parseItems(raw) {
  // format attendu: "item1, item2, item3"
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function sumValues(items, values) {
  let total = 0;
  const details = [];
  for (const name of items) {
    const entry = values[name];
    const val = entry ? entry.value : 0;
    details.push(`${entry ? '' : '⚠️ '}${name}: ${val}`);
    total += val;
  }
  return { total, details };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tradecalc')
    .setDescription('Compare deux offres de trade (sépare les items par des virgules)')
    .addStringOption(opt =>
      opt.setName('votre_offre').setDescription('Ex: item1, item2').setRequired(true))
    .addStringOption(opt =>
      opt.setName('offre_adverse').setDescription('Ex: item3, item4').setRequired(true)),

  async execute(interaction) {
    const values = readData('values.json', {});
    const yourItems = parseItems(interaction.options.getString('votre_offre'));
    const theirItems = parseItems(interaction.options.getString('offre_adverse'));

    const yourResult = sumValues(yourItems, values);
    const theirResult = sumValues(theirItems, values);

    const diff = theirResult.total - yourResult.total;
    let verdict;
    if (diff > 0) verdict = `✅ Offre adverse plus avantageuse pour toi (+${diff})`;
    else if (diff < 0) verdict = `⚠️ Tu donnes plus que tu ne reçois (${diff})`;
    else verdict = '⚖️ Trade équilibré';

    const embed = new EmbedBuilder()
      .setTitle('🔄 Comparateur de trade')
      .addFields(
        { name: 'Ton offre', value: yourResult.details.join('\n') || '—', inline: true },
        { name: 'Offre adverse', value: theirResult.details.join('\n') || '—', inline: true },
        { name: 'Total', value: `Toi: **${yourResult.total}** | Eux: **${theirResult.total}**` },
        { name: 'Verdict', value: verdict }
      )
      .setColor(diff >= 0 ? 0x2ecc71 : 0xe74c3c)
      .setFooter({ text: "⚠️ Les items sans valeur enregistrée comptent pour 0." });

    await interaction.reply({ embeds: [embed] });
  }
};
