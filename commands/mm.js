const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mm')
    .setDescription('Demande un middleman pour sécuriser ton trade'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🛡️ Demande de Middleman')
      .setDescription(
        "Un middleman (MM) est un membre de confiance qui sécurise l'échange entre deux traders.\n\n" +
        "Clique sur le bouton ci-dessous pour ouvrir un ticket privé avec le staff.\n" +
        "Prépare les infos suivantes :\n" +
        "• Ton pseudo Roblox\n• Le pseudo de l'autre trader\n• Les items échangés des deux côtés"
      )
      .setColor(0x3498db);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_mm_ticket')
        .setLabel('Demander un Middleman')
        .setEmoji('🛡️')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
