const { ModalSubmitInteraction } = require('discord.js');
const { readData, writeData } = require('../utils/db');

module.exports = async function handleModal(interaction) {
  // Expect customId format: message_modal_trade_<timestamp>
  const idMatch = interaction.customId.match(/^message_modal_(trade_\d+)$/);
  if (!idMatch) return;
  const tradeId = idMatch[1];

  const trades = readData('trades.json', {});
  const trade = trades[tradeId];
  if (!trade) {
    await interaction.reply({ content: '❌ Offre introuvable.', ephemeral: true });
    return;
  }

  const msg = interaction.fields.getTextInputValue('message_text');
  // Send DM to author
  try {
    const user = await interaction.client.users.fetch(trade.authorId);
    const from = interaction.user;
    await user.send(`✉️ Nouveau message concernant ton offre (de ${from.tag}):\n\n${msg}`);

    // store message in trade history
    trade.messages = trade.messages || [];
    trade.messages.push({ fromId: from.id, fromTag: from.tag, text: msg, at: new Date().toISOString() });
    writeData('trades.json', trades);

    await interaction.reply({ content: '✅ Message envoyé en DM à l\'auteur de l\'offre.', ephemeral: true });
  } catch (err) {
    console.error('Failed to send DM for trade message', err);
    await interaction.reply({ content: '❌ Impossible d\'envoyer le message (l\'auteur a peut-être désactivé les DMs).', ephemeral: true });
  }
};