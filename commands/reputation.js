const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readData } = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reputation')
    .setDescription("Affiche la réputation (vouches) d'un trader")
    .addUserOption(opt => opt.setName('utilisateur').setDescription('Le trader à consulter').setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('utilisateur');
    const vouches = readData('vouches.json', {});
    const blacklist = readData('blacklist.json', {});

    const userVouch = vouches[target.id] || { count: 0, history: [] };
    const isBlacklisted = blacklist[target.id];

    const embed = new EmbedBuilder()
      .setTitle(`📋 Réputation de ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: 'Vouches', value: `${userVouch.count}`, inline: true },
        { name: 'Statut', value: isBlacklisted ? '🚫 BLACKLISTÉ' : '✅ OK', inline: true }
      )
      .setColor(isBlacklisted ? 0xe74c3c : 0x2ecc71);

    if (isBlacklisted) {
      embed.addFields({ name: 'Raison blacklist', value: isBlacklisted.reason || 'Non précisée' });
    }

    if (userVouch.history.length > 0) {
      const recent = userVouch.history.slice(-3).map(h => `• ${h.comment} (${h.date})`).join('\n');
      embed.addFields({ name: 'Derniers avis', value: recent });
    }

    await interaction.reply({ embeds: [embed] });
  }
};
