const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { readData, writeData } = require('../utils/db');
const { getGuildConfig } = require('../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addvalue')
    .setDescription("[Staff] Ajoute ou met à jour la valeur d'un item")
    .addStringOption(opt => opt.setName('item').setDescription("Nom de l'item").setRequired(true).setAutocomplete(true))
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

  async autocomplete(interaction) {
    const { handleBrainrotAutocomplete } = require('../utils/autocomplete');
    await handleBrainrotAutocomplete(interaction, false);
  },

  async execute(interaction) {
    const staffRoleId = getGuildConfig(interaction.guildId).staffRoleId;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId) &&
        !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Tu n'as pas la permission d'utiliser cette commande.", ephemeral: true });
    }

    const itemName = interaction.options.getString('item').toLowerCase();
    const value = interaction.options.getInteger('valeur');
    const trend = interaction.options.getString('tendance') || 'stable';

    const allValues = readData('values.json', {});
    // keep backward compatibility: if structure is guild-scoped, store under guildId
    const guildId = interaction.guildId;
    if (allValues[guildId] && typeof allValues[guildId] === 'object') {
      allValues[guildId][itemName] = { value, trend, updatedAt: new Date().toISOString().split('T')[0] };
    } else if (allValues['_global'] && typeof allValues['_global'] === 'object') {
      allValues['_global'][itemName] = { value, trend, updatedAt: new Date().toISOString().split('T')[0] };
    } else {
      // flat shape
      allValues[itemName] = { value, trend, updatedAt: new Date().toISOString().split('T')[0] };
    }
    writeData('values.json', allValues);

    // Append to history
    const history = readData('values_history.json', []);
    history.push({ guildId, item: itemName, value, trend, updatedAt: new Date().toISOString(), author: interaction.user.tag });
    writeData('values_history.json', history);

    // Invalidate cache
    const { invalidateCache } = require('../utils/sheetValues');
    invalidateCache(guildId);

    await interaction.reply(`✅ Valeur de **${itemName}** mise à jour : **${value}** (${trend}).`);
  }
};
