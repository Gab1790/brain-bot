const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ouvre le panneau de tickets support'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🎫 Support')
      .setDescription("Besoin d'aide, un litige de trade, ou une question ? Ouvre un ticket ci-dessous.")
      .setColor(0x95a5a6);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_support_ticket')
        .setLabel('Ouvrir un ticket')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
