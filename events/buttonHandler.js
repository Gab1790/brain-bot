const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');

async function createTicketChannel(interaction, type) {
  const guild = interaction.guild;
  const categoryId = process.env.TICKET_CATEGORY_ID || null;
  const staffRoleId = process.env.STAFF_ROLE_ID;
  const mmRoleId = process.env.MIDDLEMAN_ROLE_ID;

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
  await channel.send({ content: `${interaction.user} ${mention}`, embeds: [embed], components: [closeRow] });

  await interaction.reply({ content: `✅ Ton ticket a été créé : ${channel}`, ephemeral: true });
}

async function closeTicketChannel(interaction) {
  const logChannelId = process.env.LOG_CHANNEL_ID;

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
};
