const { ModalSubmitInteraction } = require('discord.js');
const { readData, writeData } = require('../utils/db');

  module.exports = async function handleModal(interaction) {
    // --- SHOP MODALS ---
    const shopModalMatch = interaction.customId.match(/^(shop_dm_modal|shop_rep_modal)_(.+)$/);
    if (shopModalMatch) {
      const modalType = shopModalMatch[1];
      const offerId = shopModalMatch[2];

      const { getAllShops } = require('../utils/shopDb');
      const allShops = getAllShops();
      let offer = null;
      let authorId = null;

      for (const gid in allShops) {
        for (const uid in allShops[gid]) {
          for (const slot in allShops[gid][uid]) {
            if (allShops[gid][uid][slot] && allShops[gid][uid][slot].id === offerId) {
              offer = allShops[gid][uid][slot];
              authorId = uid;
              break;
            }
          }
          if (offer) break;
        }
        if (offer) break;
      }

      if (!offer) {
        return interaction.reply({ content: '❌ Cette offre n\'existe plus.', ephemeral: true });
      }

      if (modalType === 'shop_dm_modal') {
        const msgText = interaction.fields.getTextInputValue('message_text');
        try {
          const authorUser = await interaction.client.users.fetch(authorId);
          await authorUser.send(`✉️ **Message de ${interaction.user.tag}** concernant ton offre dans le shop (donne: ${offer.give} ➔ demande: ${offer.receive}):\n\n${msgText}`);
          return interaction.reply({ content: '✅ Ton message a bien été envoyé au vendeur en MP.', ephemeral: true });
        } catch (e) {
          return interaction.reply({ content: '❌ Impossible d\'envoyer le message. Le vendeur a peut-être bloqué les DMs.', ephemeral: true });
        }
      }

      if (modalType === 'shop_rep_modal') {
        const reason = interaction.fields.getTextInputValue('reason_text');
        const cfg = require('../utils/guildConfig').getGuildConfig(interaction.guildId);
        if (cfg && cfg.logChannelId) {
          try {
            const logCh = await interaction.client.channels.fetch(cfg.logChannelId);
            if (logCh) {
              const { EmbedBuilder } = require('discord.js');
              const embed = new EmbedBuilder()
                .setTitle('🚩 Signalement d\'une offre du Shop')
                .setDescription(`**Offre ID :** ${offer.id}\n**Vendeur :** <@${authorId}>\n**Signalé par :** ${interaction.user} (${interaction.user.tag})`)
                .addFields(
                  { name: 'Détails de l\'offre', value: `Donne: ${offer.give}\nDemande: ${offer.receive}` },
                  { name: 'Raison', value: reason }
                )
                .setColor(0xe74c3c)
                .setTimestamp();
              
              await logCh.send({ embeds: [embed] });
              return interaction.reply({ content: '✅ Le signalement a été envoyé à l\'équipe de modération.', ephemeral: true });
            }
          } catch (e) {
            console.error(e);
          }
        }
        return interaction.reply({ content: '✅ Signalement enregistré, mais aucun salon de logs n\'est configuré.', ephemeral: true });
      }
    }

    // Handle message modal and proof modal
    // message modal: message_modal_trade_<id>
    // proof modal: proof_modal_trade_<id>
    const msgMatch = interaction.customId.match(/^(message_modal|proof_modal|report_modal)_(trade_\d+)$/);
    if (!msgMatch) return;
    const modalType = msgMatch[1];
    const tradeId = msgMatch[2];

    const trades = readData('trades.json', {});
    const trade = trades[tradeId];
    if (!trade) {
      await interaction.reply({ content: '❌ Offre introuvable.', ephemeral: true });
      return;
    }

    if (modalType === 'message_modal') {
      const msg = interaction.fields.getTextInputValue('message_text');
      // Send DM to author
      try {
        const user = await interaction.client.users.fetch(trade.authorId);
        const from = interaction.user;
        await user.send(`✉️ Nouveau message concernant ton offre (de ${from.tag}):\n\n${msg}`);

        // store message in trade history
        trade.messages = trade.messages || [];
        trade.messages.push({ fromId: from.id, fromTag: from.tag, text: msg, at: new Date().toISOString() });
        writeData('trades.json', trades);

        await interaction.reply({ content: '✅ Message envoyé en DM à l\'auteur de l\'offre.', ephemeral: true });
      } catch (err) {
        console.error('Failed to send DM for trade message', err);
        await interaction.reply({ content: '❌ Impossible d\'envoyer le message (l\'auteur a peut-être désactivé les DMs).', ephemeral: true });
      }
      return;
    }

    if (modalType === 'proof_modal') {
      const proof = interaction.fields.getTextInputValue('proof_text');
      try {
        const from = interaction.user;
        trade.paymentProof = trade.paymentProof || [];
        trade.paymentProof.push({ fromId: from.id, fromTag: from.tag, proof, at: new Date().toISOString() });
        if (trade.status === 'awaiting_proof') {
          trade.status = 'accepted';
        }
        writeData('trades.json', trades);

        // notify author and other party if available
        try {
          const user = await interaction.client.users.fetch(trade.authorId);
          await user.send(`🔎 Une preuve de paiement a été ajoutée pour ton trade ${trade.id} par ${from.tag}:\n${proof}`).catch(() => {});
        } catch (e) {}

        await interaction.reply({ content: '✅ Preuve enregistrée.', ephemeral: true });
      } catch (err) {
        console.error('Failed to store proof', err);
        await interaction.reply({ content: '❌ Impossible d\'enregistrer la preuve.', ephemeral: true });
      }
      return;
    }

  if (modalType === 'report_modal') {
    const reason = interaction.fields.getTextInputValue('reason_text');
    try {
      const from = interaction.user;
      trade.reports = trade.reports || [];
      const report = { reporterId: from.id, reporterTag: from.tag, reason, at: new Date().toISOString(), resolved: false };
      trade.reports.push(report);
      writeData('trades.json', trades);

      // Post to log channel with moderation action buttons
      try {
        const cfg = require('../utils/guildConfig').getGuildConfig(trade.guildId || interaction.guildId);
        if (cfg && cfg.logChannelId) {
          const logCh = await interaction.client.channels.fetch(cfg.logChannelId).catch(() => null);
          if (logCh) {
            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const embed = new EmbedBuilder()
              .setTitle('🚩 Signalement de trade')
              .setDescription(`Trade: ${trade.id} • Auteur: ${trade.authorTag} (${trade.authorId})\nReporté par: ${from.tag} (${from.id})`)
              .addFields({ name: 'Raison', value: reason })
              .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`warn_author_${trade.id}`).setLabel('Avertir l\'auteur').setStyle(ButtonStyle.Danger),
              new ButtonBuilder().setCustomId(`close_report_${trade.id}`).setLabel('Clore le signalement').setStyle(ButtonStyle.Secondary)
            );

            await logCh.send({ embeds: [embed], components: [row] });
          }
        }
      } catch (e) {
        console.error('Failed to post report to log channel', e);
      }

      await interaction.reply({ content: '✅ Signalement enregistré et envoyé au staff.', ephemeral: true });
    } catch (err) {
      console.error('Failed to store report', err);
      await interaction.reply({ content: '❌ Impossible d\'enregistrer le signalement.', ephemeral: true });
    }
    return;
  }
};