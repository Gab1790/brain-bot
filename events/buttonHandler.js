const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getGuildConfig } = require('../utils/guildConfig');

async function createTicketChannel(interaction, type) {
  const guild = interaction.guild;
  const config = getGuildConfig(guild.id);
  const categoryId = config.ticketCategoryId || null;
  const staffRoleId = config.staffRoleId || null;
  const mmRoleId = config.middlemanRoleId || null;

  const relevantRoleId = type === 'mm' ? (mmRoleId || staffRoleId) : staffRoleId;
  const prefix = type === 'mm' ? 'mm' : 'ticket';

  const channelName = `${prefix}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

  const permissionOverwrites = [
    { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
  ];
  if (relevantRoleId) {
    permissionOverwrites.push({ id: relevantRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId || undefined,
    permissionOverwrites
  });

  const embed = new EmbedBuilder()
    .setTitle(type === 'mm' ? '🛡️ Nouvelle demande de Middleman' : '🎫 Nouveau ticket')
    .setDescription(
      `Ouvert par ${interaction.user}\n\n` +
      (type === 'mm'
        ? "Merci de préciser :\n• Ton pseudo Roblox\n• Le pseudo de l'autre trader\n• Les items échangés des deux côtés\n\nUn middleman va arriver sous peu."
        : "Explique ta demande, un membre du staff va te répondre.")
    )
    .setColor(type === 'mm' ? 0x3498db : 0x95a5a6);

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer le ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
  );

  const mention = relevantRoleId ? `<@&${relevantRoleId}>` : '';
  const sent = await channel.send({ content: `${interaction.user} ${mention}`, embeds: [embed], components: [closeRow] });

  await interaction.reply({ content: `✅ Ton ticket a été créé : ${channel}`, ephemeral: true });
  // return the created channel and the welcome message if caller needs to post more
  return { channel, welcomeMessage: sent };
}

async function closeTicketChannel(interaction) {
  const config = getGuildConfig(interaction.guild.id);
  const logChannelId = config.logChannelId || null;

  if (logChannelId) {
    const logChannel = interaction.guild.channels.cache.get(logChannelId);
    if (logChannel) {
      await logChannel.send(`🔒 Ticket **${interaction.channel.name}** fermé par ${interaction.user.tag}`);
    }
  }

  await interaction.reply('🔒 Ce ticket sera supprimé dans 5 secondes...');
  setTimeout(() => {
    interaction.channel.delete().catch(() => {});
  }, 5000);
}

module.exports = async function handleButton(interaction) {
  if (interaction.customId === 'open_mm_ticket') {
    return createTicketChannel(interaction, 'mm');
  }
  if (interaction.customId === 'open_support_ticket') {
    return createTicketChannel(interaction, 'ticket');
  }
  if (interaction.customId === 'close_ticket') {
    return closeTicketChannel(interaction);
  }

  // Trade buttons: accept_<id>, message_<id>, cancel_<id>
  // Also support requestmm and message modal ids
  const idMatch = interaction.customId.match(/^(accept|message|cancel|requestmm)_(trade_\d+)$/);
  if (idMatch) {
    const action = idMatch[1];
    const tradeId = idMatch[2];
    const trades = require('../utils/db').readData('trades.json', {});
    const trade = trades[tradeId];
    if (!trade) {
      return interaction.reply({ content: "❌ Offre introuvable.", ephemeral: true });
    }

    // Handle confirm/reject from MM (buttons confirm_trade_<id> / reject_trade_<id>)
    const confirmMatch = interaction.customId.match(/^(confirm_trade|reject_trade)_(trade_\d+)$/);
    if (confirmMatch) {
      const confirmAction = confirmMatch[1];
      const tId = confirmMatch[2];
      if (tId !== tradeId) {
        return interaction.reply({ content: 'IDs mismatch', ephemeral: true });
      }

      const config = require('../utils/guildConfig').getGuildConfig(interaction.guild.id);
      const mmRoleId = config.middlemanRoleId || config.staffRoleId || null;
      const isMM = mmRoleId && interaction.member.roles.cache.has(mmRoleId);
      const isMod = interaction.member.permissions.has(require('discord.js').PermissionFlagsBits.ManageMessages);
      if (!isMM && !isMod) {
        return interaction.reply({ content: '❌ Seuls les middlemen ou modérateurs peuvent confirmer.', ephemeral: true });
      }

      if (confirmAction === 'confirm_trade') {
        trade.status = 'completed';
        trade.completedBy = interaction.user.id;
        trade.completedByTag = interaction.user.tag;
        trade.completedAt = new Date().toISOString();
        require('../utils/db').writeData('trades.json', trades);

        // update original announcement if available
        try {
          if (trade.announcement && trade.announcement.channelId && trade.announcement.messageId) {
            const channel = await interaction.client.channels.fetch(trade.announcement.channelId).catch(() => null);
            if (channel) {
              const msg = await channel.messages.fetch(trade.announcement.messageId).catch(() => null);
              if (msg) {
                const updatedEmbed = require('../utils/tradeEmbed').buildEmbedFromTrade(trade);
                await msg.edit({ embeds: [updatedEmbed], components: [] }).catch(() => {});
              }
            }
          }
        } catch (err) {}

        // update ticket message
        try {
          if (trade.ticketChannelId && trade.ticketMessageId) {
            const tch = await interaction.client.channels.fetch(trade.ticketChannelId).catch(() => null);
            if (tch) {
              const tmsg = await tch.messages.fetch(trade.ticketMessageId).catch(() => null);
              if (tmsg) {
                const updatedEmbed = require('../utils/tradeEmbed').buildEmbedFromTrade(trade);
                await tmsg.edit({ embeds: [updatedEmbed], components: [] }).catch(() => {});
              }
            }
          }
        } catch (err) {}

        // notify author via DM
        try {
          const user = await interaction.client.users.fetch(trade.authorId);
          await user.send(`✅ Ton trade ${trade.id} a été confirmé par ${interaction.user.tag} (middleman).`).catch(() => {});
        } catch (err) {}

        await interaction.reply({ content: '✅ Trade marqué comme terminé.', ephemeral: true });
        return;
      }

      if (confirmAction === 'reject_trade') {
        trade.status = 'cancelled';
        trade.cancelledBy = interaction.user.id;
        trade.cancelledAt = new Date().toISOString();
        require('../utils/db').writeData('trades.json', trades);
        try {
          if (trade.announcement && trade.announcement.channelId && trade.announcement.messageId) {
            const channel = await interaction.client.channels.fetch(trade.announcement.channelId).catch(() => null);
            if (channel) {
              const msg = await channel.messages.fetch(trade.announcement.messageId).catch(() => null);
              if (msg) {
                const updatedEmbed = require('../utils/tradeEmbed').buildEmbedFromTrade(trade);
                await msg.edit({ embeds: [updatedEmbed], components: [] }).catch(() => {});
              }
            }
          }
        } catch (err) {}

        await interaction.reply({ content: '✅ Trade rejeté / annulé par le middleman.', ephemeral: true });
        return;
      }
    }

    if (action === 'accept') {
        if (trade.status !== 'open' && trade.status !== 'mm_requested') {
        return interaction.reply({ content: `❌ Ce trade n'est pas ouvert (status=${trade.status}).`, ephemeral: true });
      }
      trade.status = 'accepted';
      trade.acceptedBy = interaction.user.id;
      trade.acceptedByTag = interaction.user.tag;
      trade.acceptedAt = new Date().toISOString();
      require('../utils/db').writeData('trades.json', trades);

        // update embed message using reconstructed embed from trade
      try {
        const msg = interaction.message;
          const updatedEmbed = require('../utils/tradeEmbed').buildEmbedFromTrade(trade);
          await interaction.update({ embeds: [updatedEmbed], components: [] });
        } catch (err) {
          await interaction.reply({ content: `✅ Offre acceptée par ${interaction.user.tag}`, ephemeral: true });
        }

        return;
      }

      if (action === 'message') {
        // Show modal to collect a message to send to the author
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const modal = new ModalBuilder()
          .setCustomId(`message_modal_${tradeId}`)
          .setTitle(`Message pour ${trade.authorTag}`);

        const input = new TextInputBuilder()
          .setCustomId('message_text')
          .setLabel('Ton message')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setPlaceholder('Écris ton message ici...');

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        await interaction.showModal(modal);
        return;
      }

      if (action === 'requestmm') {
        // Create a middleman ticket and mark trade as awaiting_mm
        const config = require('../utils/guildConfig').getGuildConfig(interaction.guild.id);
        const mmRole = config.middlemanRoleId || config.staffRoleId || null;
        trade.status = 'awaiting_mm';
        trade.mmRequestedBy = interaction.user.id;
        trade.mmRequestedAt = new Date().toISOString();
        require('../utils/db').writeData('trades.json', trades);

        // Create ticket channel and notify mm role
        try {
          const result = await createTicketChannel(interaction, 'mm');
          const ch = result.channel;
          // Post the trade embed in the ticket with confirm/reject buttons for MM
          const { buildEmbedFromTrade } = require('../utils/tradeEmbed');
          const tradeEmbed = buildEmbedFromTrade(trade);
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const mmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`confirm_trade_${tradeId}`).setLabel('Confirmer le trade').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`reject_trade_${tradeId}`).setLabel('Rejeter / Annuler').setStyle(ButtonStyle.Danger)
          );
          const sent = await ch.send({ content: mmRole ? `<@&${mmRole}>` : '', embeds: [tradeEmbed], components: [mmRow] });
          trade.ticketChannelId = ch.id;
          trade.ticketMessageId = sent.id;
          require('../utils/db').writeData('trades.json', trades);
        } catch (err) {
          console.error('Failed to create mm ticket', err);
        }

        try {
          await interaction.reply({ content: '✅ Middleman demandé, le staff a été notifié.', ephemeral: true });
        } catch {}
        return;
      }

      if (action === 'cancel') {
        if (interaction.user.id !== trade.authorId && !interaction.member.permissions.has(require('discord.js').PermissionFlagsBits.ManageMessages)) {
          return interaction.reply({ content: '❌ Seul l\'auteur ou un modérateur peut annuler le trade.', ephemeral: true });
      }
        trade.status = 'cancelled';
        trade.cancelledBy = interaction.user.id;
        trade.cancelledAt = new Date().toISOString();
        require('../utils/db').writeData('trades.json', trades);
        try {
          const msg = interaction.message;
          const updatedEmbed = require('../utils/tradeEmbed').buildEmbedFromTrade(trade);
          await interaction.update({ embeds: [updatedEmbed], components: [] });
        } catch (err) {
          await interaction.reply({ content: '✅ Offre annulée.', ephemeral: true });
        }
        return;
      }
  }
};
