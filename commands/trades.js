const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readData } = require('../utils/db');
const { buildEmbedFromTrade, getTradeStatusLabel } = require('../utils/tradeEmbed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trades')
    .setDescription('Gérer / parcourir les offres P2P')
    .addSubcommand(sub => sub.setName('list').setDescription('Liste les offres ouvertes').addStringOption(opt => opt.setName('filter').setDescription('open|mine|all')))
    .addSubcommand(sub => sub.setName('view').setDescription('Affiche une offre par son id').addStringOption(opt => opt.setName('id').setDescription('ID du trade').setRequired(true)))
    .addSubcommand(sub => sub.setName('search').setDescription('Recherche des offres contenant un item').addStringOption(opt => opt.setName('q').setDescription('texte à chercher').setRequired(true).setAutocomplete(true))),

  async autocomplete(interaction) {
    const { handleBrainrotAutocomplete } = require('../utils/autocomplete');
    await handleBrainrotAutocomplete(interaction, false);
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    const trades = readData('trades.json', {});
    if (sub === 'list') {
      await interaction.deferReply({ ephemeral: true });
      const filter = (interaction.options.getString('filter') || 'open').toLowerCase();
      let items = Object.values(trades).filter(t => t.guildId === guildId);
      if (filter === 'open') items = items.filter(t => ['open', 'awaiting_proof'].includes(t.status));
      if (filter === 'mine') items = items.filter(t => t.authorId === interaction.user.id);

      if (items.length === 0) return interaction.editReply({ content: 'Aucune offre trouvée.' });

      const embed = new EmbedBuilder().setTitle(`📜 Offres (${items.length})`).setColor(0x9b59b6);
      for (const t of items.slice(0, 10)) {
        embed.addFields({ name: `${t.id} • ${t.authorTag}`, value: `Offre: ${t.offer.join(', ')} → Demande: ${t.demand.join(', ')} (status: ${getTradeStatusLabel(t.status)})` });
      }
      if (items.length > 10) embed.setFooter({ text: `Affiche les 10 premières sur ${items.length}. Utilise /trades view <id> pour voir une offre.` });
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'view') {
      const id = interaction.options.getString('id');
      const t = trades[id];
      if (!t || t.guildId !== guildId) return interaction.reply({ content: 'Offre introuvable.', ephemeral: true });
      const embed = buildEmbedFromTrade(t);
      return interaction.reply({ embeds: [embed], ephemeral: false });
    }

    if (sub === 'search') {
      const q = interaction.options.getString('q').toLowerCase();
      await interaction.deferReply({ ephemeral: true });
      const items = Object.values(trades).filter(t => t.guildId === guildId && ((t.offer||[]).join(' ').toLowerCase().includes(q) || (t.demand||[]).join(' ').toLowerCase().includes(q)));
      if (items.length === 0) return interaction.editReply({ content: 'Aucune offre trouvée.' });
      const embed = new EmbedBuilder().setTitle(`🔎 Résultats (${items.length})`).setColor(0x9b59b6);
      for (const t of items.slice(0, 10)) {
        embed.addFields({ name: `${t.id} • ${t.authorTag}`, value: `Offre: ${t.offer.join(', ')} → Demande: ${t.demand.join(', ')} (status: ${getTradeStatusLabel(t.status)})` });
      }
      return interaction.editReply({ embeds: [embed] });
    }
  }
};