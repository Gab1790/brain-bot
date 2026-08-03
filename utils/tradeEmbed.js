const { EmbedBuilder } = require('discord.js');

function buildEmbedFromTrade(trade) {
  const embed = new EmbedBuilder()
    .setTitle('🔖 Offre P2P')
    .setDescription(`Proposé par **${trade.authorTag}**`)
    .addFields(
      { name: '📦 Offre', value: (trade.offer || []).join(', ') || '—', inline: true },
      { name: '🎯 Demande', value: (trade.demand || []).join(', ') || '—', inline: true },
      { name: '💳 Paiement', value: trade.payment || '—', inline: true },
      { name: '💰 Totaux', value: `Offre: **${(trade.offerTotal||0).toLocaleString('fr-FR')}** | Demande: **${(trade.demandTotal||0).toLocaleString('fr-FR')}**`, inline: false },
      { name: '📈 Statut', value: `${trade.status || 'open'}`, inline: true }
    )
    .setTimestamp(new Date(trade.createdAt || Date.now()));

  if (trade.status === 'accepted' && trade.acceptedByTag) {
    embed.setFooter({ text: `Accepté par ${trade.acceptedByTag}` });
  } else if (trade.status === 'cancelled' && trade.cancelledBy) {
    embed.setFooter({ text: `Annulé` });
  } else if (trade.status === 'mm_requested') {
    embed.setFooter({ text: `Middleman demandé` });
  }

  return embed;
}

module.exports = { buildEmbedFromTrade };