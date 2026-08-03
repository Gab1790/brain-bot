const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { readData, writeData } = require('../utils/db');
const { getSheetValues, getGlobalAverage, invalidateCache } = require('../utils/sheetValues');
const { getGuildConfig } = require('../utils/guildConfig');

function parseItems(raw) {
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Créer une offre P2P')
    .addStringOption(opt => opt.setName('offre').setDescription("Ce que tu proposes (séparé par des virgules)").setRequired(true))
    .addStringOption(opt => opt.setName('demande').setDescription("Ce que tu veux en échange (séparé par des virgules)").setRequired(true))
    .addStringOption(opt => opt.setName('paiement').setDescription('Moyen de paiement (ex: PayPal)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();

    const guildId = interaction.guildId;
    const author = interaction.user;
    const offerRaw = interaction.options.getString('offre');
    const demandRaw = interaction.options.getString('demande');
    const payment = (interaction.options.getString('paiement') || 'PayPal').trim();

    // Basic validation & normalization
    const offerItemsRaw = parseItems(offerRaw);
    const demandItemsRaw = parseItems(demandRaw);
    if (offerItemsRaw.length === 0 || demandItemsRaw.length === 0) {
      return interaction.editReply({ content: '❌ Offre ou demande invalide. Sépare les items par des virgules.' });
    }

    const values = await getSheetValues(guildId);
    // normalization: try exact match, then startsWith/includes, then fuzzy best match, then fallback to original
    const { bestMatch } = require('../utils/fuzzy');
    const normalize = (name) => {
      const n = name.toLowerCase().trim();
      if (values[n]) return n;
      const keys = Object.keys(values);
      const byStart = keys.find(k => k.startsWith(n));
      if (byStart) return byStart;
      const byInclude = keys.find(k => k.includes(n));
      if (byInclude) return byInclude;
      const fuzzy = bestMatch(n, keys, 3);
      if (fuzzy) return fuzzy;
      return n; // unknown, keep as-is
    };

    const offerItems = offerItemsRaw.map(normalize);
    const demandItems = demandItemsRaw.map(normalize);

    // Compute totals using local values
    const sum = items => items.reduce((acc, name) => acc + ((values[name] && values[name].value) || 0), 0);
    const offerTotal = sum(offerItems);
    const demandTotal = sum(demandItems);
    const globalAvg = getGlobalAverage(guildId);

    // Rate limiting: max 5 trades per hour per user
    const limits = readData('limits.json', {});
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1h
    limits[author.id] = limits[author.id] || [];
    // remove old
    limits[author.id] = limits[author.id].filter(ts => now - ts < windowMs);
    if (limits[author.id].length >= 5) {
      return interaction.editReply({ content: '❌ Limite atteinte : max 5 trades par heure.' });
    }
    limits[author.id].push(now);
    writeData('limits.json', limits);

    // Persist trade
    const trades = readData('trades.json', {});
    const id = `trade_${Date.now()}`;
    trades[id] = {
      id,
      guildId,
      authorId: author.id,
      authorTag: author.tag,
      offer: offerItems,
      demand: demandItems,
      payment,
      offerTotal,
      demandTotal,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    writeData('trades.json', trades);
    invalidateCache(guildId);

    // Build embed + buttons
    const embed = new EmbedBuilder()
      .setTitle('🔖 Nouvelle offre P2P')
      .setDescription(`Proposé par **${author.tag}**`)
      .addFields(
        { name: '📦 Offre', value: offerItems.join(', '), inline: true },
        { name: '🎯 Demande', value: demandItems.join(', '), inline: true },
        { name: '💳 Paiement', value: payment, inline: true },
        { name: '💰 Totaux', value: `Offre: **${offerTotal.toLocaleString('fr-FR')}** | Demande: **${demandTotal.toLocaleString('fr-FR')}**`, inline: false },
        { name: '📈 Moyenne P2P globale', value: `${globalAvg.toLocaleString('fr-FR')} (référence)`, inline: false }
      )
      .setTimestamp();

    const primaryRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`accept_${id}`).setLabel('Accepter').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`message_${id}`).setLabel('Envoyer un message').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`cancel_${id}`).setLabel('Annuler').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`requestmm_${id}`).setLabel('Demander Middleman').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`proof_${id}`).setLabel('Ajouter preuve (paiement)').setStyle(ButtonStyle.Secondary)
    );

    const secondaryRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`escrow_lock_${id}`).setLabel('Verrouiller en escrow').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`escrow_cancel_${id}`).setLabel('Annuler escrow').setStyle(ButtonStyle.Danger),
      // Middleman quick-confirm button (visible to all but only usable by MM/mods)
      new ButtonBuilder().setCustomId(`mm_confirm_${id}`).setLabel('Confirmer (MM)').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`escrow_release_${id}`).setLabel('Relâcher (MM)').setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({ embeds: [embed], components: [primaryRow, secondaryRow] });
    // store announcement message id/channel for later updates
    try {
      const posted = await interaction.fetchReply();
      trades[id].announcement = { channelId: posted.channelId, messageId: posted.id };
      writeData('trades.json', trades);
    } catch (err) {
      // ignore if fetchReply fails
    }

    // If notify channel configured, post there
    const cfg = getGuildConfig(guildId);
    if (cfg.notifyChannelId) {
      try {
        const ch = await interaction.guild.channels.fetch(cfg.notifyChannelId);
        if (ch) ch.send({ embeds: [embed], components: [primaryRow, secondaryRow] }).catch(() => {});
      } catch {}
    }
  }
};