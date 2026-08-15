const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Afficher ou modifier la configuration du bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt => opt.setName('sell_channel').setDescription('Définir le salon des annonces /selling'))
    .addChannelOption(opt => opt.setName('buy_channel').setDescription('Définir le salon des annonces /buying'))
    .addIntegerOption(opt => opt.setName('sell_cooldown').setDescription("Temps d'attente pour /selling (minutes)"))
    .addIntegerOption(opt => opt.setName('buy_cooldown').setDescription("Temps d'attente pour /buying (minutes)"))
    .addRoleOption(opt => opt.setName('add_bypass_role').setDescription('Ajouter un rôle ignorant les cooldowns'))
    .addRoleOption(opt => opt.setName('remove_bypass_role').setDescription('Retirer un rôle ignorant les cooldowns'))
    .addRoleOption(opt => opt.setName('add_mm_role').setDescription('Ajouter un rôle Middleman'))
    .addRoleOption(opt => opt.setName('remove_mm_role').setDescription('Retirer un rôle Middleman'))
    .addStringOption(opt => opt.setName('color').setDescription('Changer la couleur des embeds (HEX, ex: #ff0000)')),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const config = db.getConfig(guildId);
    let updated = false;

    // Update settings if provided
    const sellChannel = interaction.options.getChannel('sell_channel');
    if (sellChannel) { config.sell_channel = sellChannel.id; updated = true; }

    const buyChannel = interaction.options.getChannel('buy_channel');
    if (buyChannel) { config.buy_channel = buyChannel.id; updated = true; }

    const sellCooldown = interaction.options.getInteger('sell_cooldown');
    if (sellCooldown !== null) { config.sell_cooldown = sellCooldown; updated = true; }

    const buyCooldown = interaction.options.getInteger('buy_cooldown');
    if (buyCooldown !== null) { config.buy_cooldown = buyCooldown; updated = true; }

    const addBypass = interaction.options.getRole('add_bypass_role');
    if (addBypass && !config.bypass_roles.includes(addBypass.id)) {
      config.bypass_roles.push(addBypass.id);
      updated = true;
    }

    const removeBypass = interaction.options.getRole('remove_bypass_role');
    if (removeBypass && config.bypass_roles.includes(removeBypass.id)) {
      config.bypass_roles = config.bypass_roles.filter(id => id !== removeBypass.id);
      updated = true;
    }

    const addMm = interaction.options.getRole('add_mm_role');
    if (addMm && !config.mm_roles.includes(addMm.id)) {
      config.mm_roles.push(addMm.id);
      updated = true;
    }

    const removeMm = interaction.options.getRole('remove_mm_role');
    if (removeMm && config.mm_roles.includes(removeMm.id)) {
      config.mm_roles = config.mm_roles.filter(id => id !== removeMm.id);
      updated = true;
    }

    const color = interaction.options.getString('color');
    if (color) {
      if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
        config.embed_color = color;
        updated = true;
      } else {
        return interaction.reply({ content: '❌ Couleur invalide. Utilisez un format HEX (ex: #ff0000)', ephemeral: true });
      }
    }

    // Save if changed
    if (updated) {
      db.saveConfig(guildId, config);
    }

    // Format roles list
    const bypassList = config.bypass_roles.length > 0 ? config.bypass_roles.map(id => `<@&${id}>`).join(', ') : 'Aucun';
    const mmList = config.mm_roles.length > 0 ? config.mm_roles.map(id => `<@&${id}>`).join(', ') : 'Aucun';

    // Build the configuration embed
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Configuration du Bot')
      .setColor(config.embed_color)
      .setDescription('Voici la configuration actuelle. Utilisez les options de la commande `/setup` pour modifier ces valeurs.')
      .addFields(
        { name: '📢 Salons', value: `**Vente (/selling) :** ${config.sell_channel ? `<#${config.sell_channel}>` : 'Non défini'}\n**Achat (/buying) :** ${config.buy_channel ? `<#${config.buy_channel}>` : 'Non défini'}` },
        { name: '⏳ Cooldowns', value: `**Vente :** ${config.sell_cooldown} minute(s)\n**Achat :** ${config.buy_cooldown} minute(s)` },
        { name: '🛡️ Rôles', value: `**Ignorer le cooldown :** ${bypassList}\n**Middleman :** ${mmList}` },
        { name: '🎨 Apparence', value: `**Couleur Embed :** ${config.embed_color}` }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
