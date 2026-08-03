const { ModalSubmitInteraction } = require('discord.js');
const { readData, writeData } = require('../utils/db');

module.exports = async function handleModal(interaction) {
    // Handle message modal and proof modal
    // message modal: message_modal_trade_<id>
    // proof modal: proof_modal_trade_<id>
    const msgMatch = interaction.customId.match(/^(message_modal|proof_modal)_(trade_\d+)$/);
    if (!msgMatch) return;
    const modalType = msgMatch[1];
    const tradeId = msgMatch[2];

    const trades = readData('trades.json', {});
    const trade = trades[tradeId];
    if (!trade) {
      await interaction.reply({ content: '❌ Offre introuvable.', ephemeral: true });
      return;
    }

    if (modalType === 'message_modal') {
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
      return;
    }

    if (modalType === 'proof_modal') {
      const proof = interaction.fields.getTextInputValue('proof_text');
      try {
        const from = interaction.user;
        trade.paymentProof = trade.paymentProof || [];
        trade.paymentProof.push({ fromId: from.id, fromTag: from.tag, proof, at: new Date().toISOString() });
        writeData('trades.json', trades);

        // notify author and other party if available
        try {
          const user = await interaction.client.users.fetch(trade.authorId);
          await user.send(`🔎 Une preuve de paiement a été ajoutée pour ton trade ${trade.id} par ${from.tag}:\n${proof}`).catch(() => {});
        } catch (e) {}

        await interaction.reply({ content: '✅ Preuve enregistrée.', ephemeral: true });
      } catch (err) {
        console.error('Failed to store proof', err);
        await interaction.reply({ content: '❌ Impossible d\'enregistrer la preuve.', ephemeral: true });
      }
      return;
    }
};