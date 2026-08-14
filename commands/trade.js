const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { readData, writeData } = require('../utils/db');
const { getSheetValues, getGlobalAverage, invalidateCache } = require('../utils/sheetValues');
const { getGuildConfig } = require('../utils/guildConfig');
const fs = require('fs');
const path = require('path');

function parseItems(raw) {
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Créer une offre P2P')
    .addStringOption(opt => opt.setName('offre').setDescription("Ce que tu proposes (séparé par des virgules)").setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('demande').setDescription("Ce que tu veux en échange (séparé par des virgules)").setRequired(true).setAutocomplete(true))
    .addStringOption(opt => opt.setName('paiement').setDescription('Moyen de paiement (ex: PayPal)').setRequired(false))
    .addAttachmentOption(opt => opt.setName('image').setDescription('Image illustrative (optionnel)').setRequired(false)),


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
      new ButtonBuilder().setCustomId(`message_${id}`).setLabel('Envoyer un message').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`accept_${id}`).setLabel('Accepter').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`report_${id}`).setLabel('Signaler').setStyle(ButtonStyle.Danger)
    );

    // Determine image to attach/display: prefer user-provided attachment, else look for local item images matching normalized names
    const attachmentOption = interaction.options.getAttachment('image');
    let filesToSend = undefined;
    if (attachmentOption) {
      embed.setImage(attachmentOption.url);
    } else {
      const tryNames = [...offerItems, ...demandItems];
      const assetsDir = path.join(__dirname, '..', 'assets', 'item-images');
      const exts = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
      let found = null;
      for (const name of tryNames) {
        const safeName = name.replace(/[^a-z0-9-_]/gi, '_');
        for (const ext of exts) {
          const fp = path.join(assetsDir, `${safeName}${ext}`);
          if (fs.existsSync(fp)) {
            found = { path: fp, name: `${safeName}${ext}` };
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        // try cache then Fandom (if configured)
        const cache = readData('imageCache.json', {});
        let cachedUrl = null;
        for (const name of tryNames) {
          const safeName = name.replace(/[^a-z0-9-_]/gi, '_');
          if (cache[safeName]) { cachedUrl = cache[safeName]; break; }
        }

        if (!cachedUrl) {
          // attempt to query fandom for the first matching item name using configured wiki
          const cfg = getGuildConfig(guildId) || {};
          // Use Steal a Brainrot Wiki by default for all servers unless overridden in guild config
          const domain = cfg.defaultItemWiki || 'stealabrainrot.fandom.com';
          if (domain) {
            try {
              const { getFandomImage } = require('../utils/fandom');
              for (const name of tryNames) {
                const url = await getFandomImage(domain, name);
                if (url) {
                  cachedUrl = url;
                  // store in cache by safeName
                  const safeName = name.replace(/[^a-z0-9-_]/gi, '_');
                  cache[safeName] = url;
                  writeData('imageCache.json', cache);
                  break;
                }
              }
            } catch (e) {
              // ignore fandom failures
            }
          }
        }

        if (cachedUrl) {
          embed.setImage(cachedUrl);
        }
      }

      if (found) {
        // set embed image to attachment and prepare files array
        embed.setImage(`attachment://${found.name}`);
        filesToSend = [{ attachment: found.path, name: found.name }];
      }
    }

    // Only publish the simplified primary row (message, accept, report), include files if found
    const editOptions = { embeds: [embed], components: [primaryRow] };
    if (filesToSend) editOptions.files = filesToSend;
    await interaction.editReply(editOptions);

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
        if (ch) ch.send({ embeds: [embed], components: [primaryRow], files: filesToSend || undefined }).catch(() => {});
      } catch {}
    }
  },

  async autocomplete(interaction) {
    const { handleBrainrotAutocomplete } = require('../utils/autocomplete');
    await handleBrainrotAutocomplete(interaction, true);
  }
};