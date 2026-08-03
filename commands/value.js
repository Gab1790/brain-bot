const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readData } = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('value')
    .setDescription("Affiche la valeur estimée d'un item")
    .addStringOption(opt =>
      opt.setName('item')
        .setDescription("Nom de l'item")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const values = readData('values.json', {});
    const focused = interaction.options.getFocused().toLowerCase();
    const matches = Object.keys(values)
      .filter(name => name.toLowerCase().includes(focused))
      .slice(0, 25);
    await interaction.respond(matches.map(name => ({ name, value: name })));
  },

  async execute(interaction) {
    const itemName = interaction.options.getString('item').toLowerCase();
    const values = readData('values.json', {});
    const item = values[itemName];

    if (!item) {
      return interaction.reply({
        content: `❌ Aucune valeur trouvée pour **${itemName}**. Demande à un membre du staff de l'ajouter avec \`/addvalue\`.`,
        ephemeral: true
      });
    }

    const trendEmoji = { up: '📈', down: '📉', stable: '➖' }[item.trend] || '➖';

    const embed = new EmbedBuilder()
      .setTitle(`💰 Valeur de ${itemName}`)
      .addFields(
        { name: 'Valeur', value: `${item.value}`, inline: true },
        { name: 'Tendance', value: trendEmoji, inline: true },
        { name: 'Mise à jour', value: item.updatedAt || 'inconnue', inline: true }
      )
      .setColor(0x9b59b6)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
