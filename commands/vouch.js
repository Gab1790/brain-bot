const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readData, writeData } = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vouch')
    .setDescription('Donne un vouch (avis positif) à un trader')
    .addUserOption(opt => opt.setName('utilisateur').setDescription('Le trader à vouch').setRequired(true))
    .addStringOption(opt => opt.setName('commentaire').setDescription('Commentaire optionnel')),

  async execute(interaction) {
    const target = interaction.options.getUser('utilisateur');
    const comment = interaction.options.getString('commentaire') || 'Aucun commentaire';

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: '❌ Tu ne peux pas te vouch toi-même.', ephemeral: true });
    }

    const vouches = readData('vouches.json', {});
    if (!vouches[target.id]) vouches[target.id] = { count: 0, history: [] };

    vouches[target.id].count += 1;
    vouches[target.id].history.push({
      by: interaction.user.id,
      comment,
      date: new Date().toISOString().split('T')[0]
    });

    writeData('vouches.json', vouches);

    const embed = new EmbedBuilder()
      .setTitle('✅ Nouveau vouch')
      .setDescription(`${interaction.user} a vouch ${target} !`)
      .addFields(
        { name: 'Commentaire', value: comment },
        { name: 'Total vouches', value: `${vouches[target.id].count}` }
      )
      .setColor(0x2ecc71)
      .setThumbnail(target.displayAvatarURL());

    await interaction.reply({ embeds: [embed] });
  }
};
