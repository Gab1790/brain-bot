const db = require('../utils/db');

module.exports = async (interaction) => {
  if (!interaction.isButton()) return;
  
  if (interaction.customId.startsWith('mp_')) {
    const adId = interaction.customId.split('_')[1];
    const ad = db.getAd(adId);
    
    if (!ad) {
      return interaction.reply({ content: '❌ Cette annonce n\\'existe plus ou est introuvable.', ephemeral: true });
    }
    
    // Prevent clicking on own ad
    if (ad.user_id === interaction.user.id) {
      return interaction.reply({ content: '❌ Tu ne peux pas interagir avec ta propre annonce.', ephemeral: true });
    }
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Fetch the seller/buyer
      const owner = await interaction.client.users.fetch(ad.user_id);
      const isSelling = ad.type === 'SELL';
      
      // DM to the user who clicked the button
      let dmContentForClicker = '';
      if (isSelling) {
        dmContentForClicker = `Bonjour ! Tu as indiqué être intéressé par cette annonce :\n\n**${ad.item_name}**\nLe vendeur : <@${ad.user_id}>\n\nTu peux maintenant discuter avec le vendeur pour négocier le prix.`;
      } else {
        dmContentForClicker = `🔔 Bonne nouvelle !\n\n<@${ad.user_id}> possède le Brainrot que tu recherches :\n\n**${ad.item_name}**\n\nTu peux maintenant le contacter pour discuter du prix et du trade.`;
      }
      
      await interaction.user.send(dmContentForClicker);
      
      // DM to the owner of the ad
      let dmContentForOwner = '';
      if (isSelling) {
        dmContentForOwner = `🔔 Nouvelle personne intéressée !\n\n<@${interaction.user.id}> est intéressé par ton annonce :\n**${ad.item_name}**\n\nTu peux le contacter en message privé pour discuter du prix.`;
      } else {
        dmContentForOwner = `🔔 Une personne possède ce que tu recherches !\n\n<@${interaction.user.id}> a cliqué sur ton annonce :\n**${ad.item_name}**\n\nTu peux maintenant discuter avec cette personne pour proposer ton prix.`;
      }
      
      await owner.send(dmContentForOwner);
      
      await interaction.editReply({ content: '✅ Messages envoyés avec succès aux deux parties ! Vérifie tes messages privés.' });
      
    } catch (err) {
      console.error('Error sending DM:', err);
      await interaction.editReply({ content: '❌ Impossible d\\'envoyer un message privé. L\\'un des deux utilisateurs a peut-être bloqué les messages privés du bot.' });
    }
  }
};
