const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getSheetValues, getDynamicItemValue } = require('../utils/sheetValues');
const { searchBrainrots, getBrainrotInfo } = require('../utils/fandomApi');
const { getGuildConfig } = require('../utils/guildConfig');

const TREND_EMOJI = { up: '📈', down: '📉', stable: '➖' };
const RARITY_COLOR = {
  Common:    0x95a5a6,
  Uncommon:  0x2ecc71,
  Rare:      0x3498db,
  Epic:      0x9b59b6,
  Legendary: 0xf1c40f,
  Secret:    0xe74c3c,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('value')
    .setDescription("Affiche la valeur de trade et les stats d'un brainrot")
    .addStringOption(opt =>
      opt.setName('item')
        .setDescription("Nom du brainrot")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const { handleBrainrotAutocomplete } = require('../utils/autocomplete');
    await handleBrainrotAutocomplete(interaction, false);
  },

  async execute(interaction) {
    await interaction.deferReply();

    const itemName = interaction.options.getString('item').toLowerCase().trim();
    const guildId  = interaction.guildId;

    // Fetch both sources in parallel
    const [sheetVals, fandomInfo] = await Promise.allSettled([
      getSheetValues(guildId),
      getBrainrotInfo(itemName),
    ]);

    const tradeItem = sheetVals.status === 'fulfilled'
      ? sheetVals.value[itemName] || null
      : null;

    const stats = fandomInfo.status === 'fulfilled'
      ? fandomInfo.value
      : null;

    // If we found nothing at all
    if (!tradeItem && !stats) {
      const hasLocalValues = sheetVals.status === 'fulfilled' && Object.keys(sheetVals.value || {}).length > 0;
      return interaction.editReply({
        content:
          `❌ Aucune donnée trouvée pour **${itemName}**.\n` +
          (!hasLocalValues
            ? '💡 Aucune valeur locale trouvée. Un admin peut utiliser `/addvalue` ou `/setup set_global_average` pour ajouter des références.\n'
            : '💡 Vérifie l\'orthographe ou demande au staff de mettre à jour la base locale.\n') +
          '💡 Ou consulte directement le wiki : ' +
          `https://stealabrainrot.fandom.com/wiki/${encodeURIComponent(itemName)}`,
      });
    }

    const rarity    = stats?.rarity || null;
    const embedColor = RARITY_COLOR[rarity] ?? 0x9b59b6;
    const displayName = stats?.name || itemName;

    const embed = new EmbedBuilder()
      .setTitle(`🧠 ${displayName}`)
      .setColor(embedColor)
      .setTimestamp()
      .setFooter({ text: 'Sources : base locale (trade) + Wiki Fandom (stats)' });

    // ── Trade value (local values) ──────────────────────────────────────
    if (tradeItem) {
      const dynamicVal = getDynamicItemValue(itemName, guildId);
      const trendEmoji = TREND_EMOJI[tradeItem.trend] || '➖';
      embed.addFields({
        name: '💰 Valeur de trade (P2P)',
        value: [
          `**Valeur de base :** ${tradeItem.value.toLocaleString('fr-FR')}`,
          `**Moyenne dynamique :** ${dynamicVal.toLocaleString('fr-FR')} (trades passés)`,
          `**Tendance :** ${trendEmoji} ${tradeItem.trend}`,
          tradeItem.updatedAt ? `**Mis à jour :** ${tradeItem.updatedAt}` : '',
        ].filter(Boolean).join('\n'),
        inline: true,
      });
    } else {
      embed.addFields({
        name: '💰 Valeur de trade (P2P)',
        value: '_Pas encore dans la base locale_',
        inline: true,
      });
    }

    // ── Game stats (Fandom wiki) ────────────────────────────────────────
    if (stats) {
      embed.addFields({
        name: '📊 Stats officielles (jeu)',
        value: [
          rarity   ? `**Rareté :** ${rarity}` : '',
          stats.cost   ? `**Coût :** $${stats.cost}` : '',
          stats.income ? `**Income :** $${stats.income}/s` : '',
          stats.status ? `**Status :** ${stats.status}` : '',
          stats.obtained ? `**Obtention :** ${stats.obtained}` : '',
        ].filter(Boolean).join('\n') || '_Données non disponibles_',
        inline: true,
      });

      embed.addFields({
        name: '🔗 Wiki',
        value: `[Voir sur le wiki Fandom](https://stealabrainrot.fandom.com/wiki/${encodeURIComponent(stats.name)})`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });

    // If notify channel is set and this was a guild query, optionally post a brief note
    try {
      const cfg = getGuildConfig(guildId);
      if (cfg && cfg.notifyChannelId) {
        const ch = await interaction.guild.channels.fetch(cfg.notifyChannelId).catch(() => null);
        if (ch) ch.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (err) {}
  }
};
