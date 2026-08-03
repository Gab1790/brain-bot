const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getSheetValues } = require('../utils/sheetValues');

function parseItems(raw) {
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function sumValues(items, values) {
  let total = 0;
  const details = [];
  for (const name of items) {
    const entry = values[name];
    const val = entry ? entry.value : 0;
    const known = !!entry;
    details.push(`${known ? '' : '⚠️ '}${name}: **${known ? val.toLocaleString('fr-FR') : '?'}**`);
    total += val;
  }
  return { total, details };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tradecalc')
    .setDescription('Compare deux offres de trade (sépare les items par des virgules)')
    .addStringOption(opt =>
      opt.setName('votre_offre').setDescription('Ex: 1x1x1x1, john doe').setRequired(true))
    .addStringOption(opt =>
      opt.setName('offre_adverse').setDescription('Ex: rocco disco, bunito').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();

    const guildId    = interaction.guildId;
    const values     = await getSheetValues(guildId);
    const yourItems  = parseItems(interaction.options.getString('votre_offre'));
    const theirItems = parseItems(interaction.options.getString('offre_adverse'));

    const yourResult  = sumValues(yourItems, values);
    const theirResult = sumValues(theirItems, values);

    const diff = theirResult.total - yourResult.total;
    let verdict;
    if (diff > 0)       verdict = `✅ Offre adverse plus avantageuse pour toi (+${diff.toLocaleString('fr-FR')})`;
    else if (diff < 0)  verdict = `⚠️ Tu donnes plus que tu ne reçois (${diff.toLocaleString('fr-FR')})`;
    else                verdict = '⚖️ Trade équilibré';

    const hasSheet = Object.keys(values).length > 0;

    const embed = new EmbedBuilder()
      .setTitle('🔄 Comparateur de trade')
      .addFields(
        { name: 'Ton offre',     value: yourResult.details.join('\n')  || '—', inline: true },
        { name: 'Offre adverse', value: theirResult.details.join('\n') || '—', inline: true },
        { name: 'Total', value: `Toi: **${yourResult.total.toLocaleString('fr-FR')}** | Eux: **${theirResult.total.toLocaleString('fr-FR')}**` },
        { name: 'Verdict', value: verdict }
      )
      .setColor(diff >= 0 ? 0x2ecc71 : 0xe74c3c)
      .setFooter({
        text: hasSheet
          ? '⚠️ Les items avec ⚠️ ne sont pas dans le sheet (valeur = 0).'
          : '⚠️ Aucun sheet configuré. Utilisez /setup sheet_url pour en ajouter un.',
      });

    await interaction.editReply({ embeds: [embed] });
  }
};
