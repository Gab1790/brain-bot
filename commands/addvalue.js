const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { readData, writeData } = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addvalue')
    .setDescription("[Staff] Ajoute ou met à jour la valeur d'un item")
    .addStringOption(opt => opt.setName('item').setDescription("Nom de l'item").setRequired(true))
    .addIntegerOption(opt => opt.setName('valeur').setDescription("Valeur de l'item").setRequired(true))
    .addStringOption(opt =>
      opt.setName('tendance')
        .setDescription("Tendance actuelle")
        .addChoices(
          { name: 'En hausse', value: 'up' },
          { name: 'En baisse', value: 'down' },
          { name: 'Stable', value: 'stable' }
        )
    ),

  async execute(interaction) {
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId) &&
        !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Tu n'as pas la permission d'utiliser cette commande.", ephemeral: true });
    }

    const itemName = interaction.options.getString('item').toLowerCase();
    const value = interaction.options.getInteger('valeur');
    const trend = interaction.options.getString('tendance') || 'stable';

    const values = readData('values.json', {});
    values[itemName] = {
      value,
      trend,
      updatedAt: new Date().toISOString().split('T')[0]
    };
    writeData('values.json', values);

    await interaction.reply(`✅ Valeur de **${itemName}** mise à jour : **${value}** (${trend}).`);
  }
};
