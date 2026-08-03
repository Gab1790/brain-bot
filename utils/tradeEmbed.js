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

    // time to expire (if configured) and proof count
    try {
      const cfg = require('./guildConfig').getGuildConfig(trade.guildId || null) || {};
      const ttlDays = typeof cfg.tradeTTLDays === 'number' ? cfg.tradeTTLDays : 7;
      if (trade.createdAt) {
        const created = new Date(trade.createdAt).getTime();
        const expiresAt = new Date(created + ttlDays * 24 * 60 * 60 * 1000);
        const remainingMs = expiresAt.getTime() - Date.now();
        if (remainingMs > 0) {
          const days = Math.floor(remainingMs / (24*60*60*1000));
          const hrs = Math.floor((remainingMs % (24*60*60*1000)) / (60*60*1000));
          embed.addFields({ name: '⏳ Expiration', value: `${days}j ${hrs}h`, inline: true });
        } else {
          embed.addFields({ name: '⏳ Expiration', value: 'Expiré', inline: true });
        }
      }
    } catch (e) {}

    if (trade.paymentProof && trade.paymentProof.length) {
      embed.addFields({ name: '🔎 Preuves', value: `${trade.paymentProof.length} preuve(s)`, inline: true });
    }

    // Escrow details
    if (trade.escrow) {
      const esc = trade.escrow;
      let escText = `Statut: **${esc.status || 'none'}**`;
      if (esc.requestedByTag) escText += `\nDemandé par : ${esc.requestedByTag}`;
      if (esc.requestedAt) escText += `\nDemandé le : ${new Date(esc.requestedAt).toLocaleString('fr-FR')}`;
      if (esc.releasedByTag) escText += `\nRelâché par : ${esc.releasedByTag} le ${esc.releasedAt ? new Date(esc.releasedAt).toLocaleString('fr-FR') : ''}`;
      if (esc.cancelledBy) escText += `\nAnnulé par : ${esc.cancelledBy}`;
      embed.addFields({ name: '🛡️ Escrow', value: escText, inline: true });
    }

    if (trade.status === 'accepted' && trade.acceptedByTag) {
    embed.setFooter({ text: `Accepté par ${trade.acceptedByTag}` });
  } else if (trade.status === 'cancelled' && trade.cancelledBy) {
    embed.setFooter({ text: `Annulé` });
  } else if (trade.status === 'mm_requested' || trade.status === 'awaiting_mm') {
    embed.setFooter({ text: `Middleman demandé` });
  } else if (trade.status === 'completed') {
    embed.setFooter({ text: `Terminé par ${trade.completedByTag || 'un middleman'}` });
  }

  return embed;
}

module.exports = { buildEmbedFromTrade };