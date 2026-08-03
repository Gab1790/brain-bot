const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Affiche la liste des commandes du bot'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📖 Commandes disponibles')
      .addFields(
        { name: '💰 Trade', value:
          '`/value [item]` — Voir la valeur d\'un item\n' +
          '`/tradecalc` — Comparer deux offres\n' +
          '`/addvalue` — [Staff] Ajouter/modifier une valeur'
        },
        { name: '🛡️ Sécurité', value:
          '`/mm` — Demander un middleman\n' +
          '`/vouch @user` — Vouch un trader\n' +
          '`/reputation @user` — Voir la réputation d\'un trader\n' +
          '`/blacklist` — [Staff] Gérer la blacklist scam'
        },
        { name: '🎫 Support', value: '`/ticket` — Ouvrir le panneau de tickets' }
      )
      .setColor(0x9b59b6)
      .setFooter({ text: 'Bot Brainrot Trade' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
