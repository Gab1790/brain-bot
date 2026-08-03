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
          '`/value [item]` — Voir la valeur (trade + stats Fandom)\n' +
          '`/tradecalc` — Comparer deux offres\n' +
          '_Les valeurs de trade sont maintenues par le staff dans Google Sheets_'
        },
        { name: '🛡️ Sécurité', value:
          '`/mm` — Demander un middleman\n' +
          '`/vouch @user` — Vouch un trader\n' +
          '`/reputation @user` — Voir la réputation d\'un trader\n' +
          '`/blacklist` — [Staff] Gérer la blacklist scam'
        },
        { name: '🎫 Support', value: '`/ticket` — Ouvrir le panneau de tickets' },
        { name: '⚙️ Configuration (Admin)', value:
          '`/setup voir` — Voir la config du serveur\n' +
          '`/setup staff_role` — Définir le rôle Staff\n' +
          '`/setup middleman_role` — Définir le rôle Middleman\n' +
          '`/setup ticket_category` — Catégorie de tickets\n' +
          '`/setup log_channel` — Salon de logs\n' +
          '`/setup sheet_url` — 📊 Lier le Google Sheet de trade\n' +
          '`/setup reset` — Réinitialiser la config'
        }
      )
      .setColor(0x9b59b6)
      .setFooter({ text: 'Bot Brainrot Trade' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
