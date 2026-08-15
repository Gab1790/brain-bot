const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buying')
    .setDescription('Créer une annonce pour rechercher un objet / Brainrot')
    .addStringOption(opt => opt.setName('nom').setDescription('Nom exact de ce que vous recherchez').setRequired(true))
    .addIntegerOption(opt => opt.setName('quantite').setDescription('Combien en recherchez-vous ?').setRequired(true))
    .addStringOption(opt => opt.setName('prix_min').setDescription('Budget minimum').setRequired(true))
    .addStringOption(opt => opt.setName('prix_max').setDescription('Budget maximum').setRequired(true))
    .addStringOption(opt => opt.setName('paiement').setDescription('Moyens de paiement proposés (ex: Robux, PayPal...)').setRequired(true))
    .addStringOption(opt => opt.setName('middleman').setDescription('Acceptez-vous un Middleman ?').setRequired(true).addChoices(
      { name: 'Oui', value: 'Oui' },
      { name: 'Non', value: 'Non' }
    ))
    .addAttachmentOption(opt => opt.setName('image').setDescription("Image de l'objet recherché (Optionnel)"))
    .addStringOption(opt => opt.setName('description').setDescription('Informations supplémentaires (Optionnel)')),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const config = db.getConfig(guildId);
    
    if (!config.buy_channel) {
      return interaction.reply({ content: "❌ Le salon d'achat n'a pas été configuré par un administrateur (`/setup channels`).", ephemeral: true });
    }

    // Check Cooldown
    const memberRoles = interaction.member.roles.cache.map(r => r.id);
    const cooldownStatus = db.checkCooldown(interaction.user.id, 'BUYING', config.buy_cooldown, memberRoles, config.bypass_roles);
    
    if (cooldownStatus.onCooldown) {
      const remainingMin = Math.ceil(cooldownStatus.remaining / 60000);
      return interaction.reply({ content: `⏳ Tu dois attendre encore **${remainingMin} minute(s)** avant de pouvoir publier une nouvelle annonce.`, ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const adId = db.generateAdId('BUY');
    const image = interaction.options.getAttachment('image');
    
    const adData = {
      id: adId,
      type: 'BUY',
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
      .setTitle('🔎 RECHERCHE')
      .setColor(config.embed_color)
      .setDescription(`🏷️ **Recherche :** ${adData.item_name}\n📦 **Quantité :** ${adData.quantity}\n💰 **Budget :** ${adData.min_price} - ${adData.max_price}\n💳 **Paiement :** ${adData.payment}\n🛡️ **Middleman :** ${adData.middleman}\n👤 **Acheteur :** <@${adData.user_id}>`)
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
        .setLabel("✅ J'AI ÇA")
        .setStyle(ButtonStyle.Success)
    );

    try {
      const channel = await interaction.guild.channels.fetch(config.buy_channel);
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
