const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { readData, writeData } = require('../utils/db');
const { getGuildConfig } = require('../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('[Staff] Ajoute ou retire un utilisateur de la blacklist scam')
    .addSubcommand(sub =>
      sub.setName('ajouter')
        .setDescription('Ajoute un utilisateur à la blacklist')
        .addUserOption(opt => opt.setName('utilisateur').setDescription('Utilisateur à blacklister').setRequired(true))
        .addStringOption(opt => opt.setName('raison').setDescription('Raison').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('retirer')
        .setDescription('Retire un utilisateur de la blacklist')
        .addUserOption(opt => opt.setName('utilisateur').setDescription('Utilisateur à retirer').setRequired(true))
    ),

  async execute(interaction) {
    const staffRoleId = getGuildConfig(interaction.guildId).staffRoleId;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId) &&
        !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Tu n'as pas la permission d'utiliser cette commande.", ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('utilisateur');
    const blacklist = readData('blacklist.json', {});

    if (sub === 'ajouter') {
      const reason = interaction.options.getString('raison');
      blacklist[target.id] = { reason, by: interaction.user.id, date: new Date().toISOString().split('T')[0] };
      writeData('blacklist.json', blacklist);
      return interaction.reply(`🚫 ${target} a été ajouté à la blacklist.\nRaison : ${reason}`);
    }

    if (sub === 'retirer') {
      delete blacklist[target.id];
      writeData('blacklist.json', blacklist);
      return interaction.reply(`✅ ${target} a été retiré de la blacklist.`);
    }
  }
};
