const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('selling')
    .setDescription('Créer une annonce pour vendre un objet / Brainrot')
    .addStringOption(opt => opt.setName('nom').setDescription('Nom exact de ce que vous vendez').setRequired(true))
    .addIntegerOption(opt => opt.setName('quantite').setDescription('Quantité disponible').setRequired(true))
    .addStringOption(opt => opt.setName('prix_min').setDescription('Prix minimum accepté').setRequired(true))
    .addStringOption(opt => opt.setName('prix_max').setDescription('Prix maximum souhaité').setRequired(true))
    .addStringOption(opt => opt.setName('paiement').setDescription('Moyens de paiement acceptés (ex: Robux, PayPal...)').setRequired(true))
    .addStringOption(opt => opt.setName('middleman').setDescription('Acceptez-vous un Middleman ?').setRequired(true).addChoices(
      { name: 'Oui', value: 'Oui' },
      { name: 'Non', value: 'Non' }
    ))
    .addAttachmentOption(opt => opt.setName('image').setDescription("Image de l'objet (Optionnel)"))
    .addStringOption(opt => opt.setName('description').setDescription('Informations supplémentaires (Optionnel)')),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const config = db.getConfig(guildId);
    
    if (!config.sell_channel) {
      return interaction.reply({ content: "❌ Le salon de vente n'a pas été configuré par un administrateur (`/setup channels`).", ephemeral: true });
    }

    // Check Cooldown
    const memberRoles = interaction.member.roles.cache.map(r => r.id);
    const cooldownStatus = db.checkCooldown(interaction.user.id, 'SELLING', config.sell_cooldown, memberRoles, config.bypass_roles);
    
    if (cooldownStatus.onCooldown) {
      const remainingMin = Math.ceil(cooldownStatus.remaining / 60000);
      return interaction.reply({ content: `⏳ Tu dois attendre encore **${remainingMin} minute(s)** avant de pouvoir publier une nouvelle annonce.`, ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const adId = db.generateAdId('SELL');
    const image = interaction.options.getAttachment('image');
    
    const adData = {
      id: adId,
      type: 'SELL',
      user_id: interaction.user.id,
      item_name: interaction.options.getString('nom'),
      quantity: interaction.options.getInteger('quantite'),
      min_price: interaction.options.getString('prix_min'),
      max_price: interaction.options.getString('prix_max'),
      payment: interaction.options.getString('paiement'),
      middleman: interaction.options.getString('middleman'),
      description: interaction.options.getString('description'),
      image_url: image ? image.url : null
    };

    const embed = new EmbedBuilder()
      .setTitle('🛒 VENTE')
      .setColor(config.embed_color)
      .setDescription(`🏷️ **Nom :** ${adData.item_name}\n📦 **Quantité :** ${adData.quantity}\n💰 **Prix :** ${adData.min_price} - ${adData.max_price}\n💳 **Paiement :** ${adData.payment}\n🛡️ **Middleman :** ${adData.middleman}\n👤 **Vendeur :** <@${adData.user_id}>`)
      .setFooter({ text: `${interaction.guild.name} • ID: ${adId}`, iconURL: interaction.guild.iconURL() })
      .setTimestamp();

    if (adData.description) {
      embed.addFields({ name: '📝 Description', value: adData.description });
    }
    if (adData.image_url) {
      embed.setImage(adData.image_url);
    }
    if (interaction.user.displayAvatarURL()) {
      embed.setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mp_${adId}`)
        .setLabel('💬 MP')
        .setStyle(ButtonStyle.Primary)
    );

    try {
      const channel = await interaction.guild.channels.fetch(config.sell_channel);
      const message = await channel.send({ embeds: [embed], components: [row] });
      
      adData.message_id = message.id;
      adData.channel_id = channel.id;
      db.createAd(adData);

      await interaction.editReply({ content: `✅ Ton annonce a été publiée avec succès dans <#${channel.id}> !` });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: "❌ Erreur lors de la publication de l'annonce. Vérifiez les permissions du bot dans le salon configuré." });
    }
  }
};
