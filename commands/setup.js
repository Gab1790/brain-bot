const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('../utils/guildConfig');
const { invalidateCache } = require('../utils/sheetValues');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('[Admin] Configure le bot pour ce serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('voir')
        .setDescription('Affiche la configuration actuelle du serveur')
    )
    .addSubcommand(sub =>
      sub.setName('staff_role')
        .setDescription('Définit le rôle Staff qui peut modifier les valeurs et la blacklist')
        .addRoleOption(opt => opt.setName('role').setDescription('Rôle Staff').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('middleman_role')
        .setDescription('Définit le rôle Middleman')
        .addRoleOption(opt => opt.setName('role').setDescription('Rôle Middleman').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('ticket_category')
        .setDescription('Définit la catégorie où seront créés les tickets')
        .addChannelOption(opt => opt.setName('categorie').setDescription('Catégorie Discord').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('log_channel')
        .setDescription('Définit le salon de logs des tickets fermés')
        .addChannelOption(opt => opt.setName('salon').setDescription('Salon de logs').setRequired(true))
    )
    .addSubcommand(sub =>
          sub.setName('notify_channel')
            .setDescription('Définit le salon où poster automatiquement les nouvelles offres')
            .addChannelOption(opt => opt.setName('salon').setDescription('Salon de notifications').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('set_global_average')
            .setDescription('Définit la moyenne P2P globale manuellement')
            .addIntegerOption(opt => opt.setName('value').setDescription('Valeur numérique').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('shop_role')
            .setDescription('Rôle donnant droit à 1 page supplémentaire dans le shop')
            .addRoleOption(opt => opt.setName('role').setDescription('Rôle Shop VIP').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('shop_page_size')
            .setDescription('Nombre de trades par page du shop (ex: 5)')
            .addIntegerOption(opt => opt.setName('size').setDescription('Taille de la page').setRequired(true).setMinValue(1).setMaxValue(25))
        )
        .addSubcommand(sub =>
          sub.setName('reset')
            .setDescription('Réinitialise toute la configuration de ce serveur')
        ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();

    if (sub === 'voir') {
      const config = getGuildConfig(guildId);
      const staffRole   = config.staffRoleId    ? `<@&${config.staffRoleId}>` : '❌ Non configuré';
      const mmRole      = config.middlemanRoleId ? `<@&${config.middlemanRoleId}>` : '❌ Non configuré';
      const ticketCat   = config.ticketCategoryId ? `<#${config.ticketCategoryId}>` : '❌ Non configuré (racine)';
      const logChannel  = config.logChannelId   ? `<#${config.logChannelId}>` : '❌ Non configuré';
      const globalAvg   = config.globalAverage != null ? `${config.globalAverage}` : '❌ Non défini';
      const shopRole    = config.shopRoleId ? `<@&${config.shopRoleId}>` : '❌ Non configuré';
      const shopSize    = config.shopPageSize != null ? `${config.shopPageSize}` : '5 (par défaut)';

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Configuration du serveur')
        .addFields(
          { name: '🛡️ Rôle Staff',      value: staffRole,    inline: true },
          { name: '🤝 Rôle Middleman',   value: mmRole,       inline: true },
          { name: '📁 Catégorie tickets',value: ticketCat,    inline: true },
          { name: '📋 Salon de logs',    value: logChannel,   inline: true },
          { name: '📈 Moyenne globale',  value: globalAvg,    inline: true },
          { name: '🛍️ Rôle Shop (+1p)',  value: shopRole,     inline: true },
          { name: '📑 Taille page Shop', value: shopSize,     inline: true }
        )
        .setColor(0x9b59b6)
        .setFooter({ text: 'Utilisez /setup <option> pour modifier la configuration.' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'staff_role') {
      const role = interaction.options.getRole('role');
      setGuildConfig(guildId, { staffRoleId: role.id });
      return interaction.reply({ content: `✅ Rôle Staff défini : ${role}`, ephemeral: true });
    }

    if (sub === 'middleman_role') {
      const role = interaction.options.getRole('role');
      setGuildConfig(guildId, { middlemanRoleId: role.id });
      return interaction.reply({ content: `✅ Rôle Middleman défini : ${role}`, ephemeral: true });
    }

    if (sub === 'ticket_category') {
      const channel = interaction.options.getChannel('categorie');
      setGuildConfig(guildId, { ticketCategoryId: channel.id });
      return interaction.reply({ content: `✅ Catégorie de tickets définie : ${channel}`, ephemeral: true });
    }

    if (sub === 'log_channel') {
      const channel = interaction.options.getChannel('salon');
      setGuildConfig(guildId, { logChannelId: channel.id });
      return interaction.reply({ content: `✅ Salon de logs défini : ${channel}`, ephemeral: true });
    }

    if (sub === 'notify_channel') {
      const channel = interaction.options.getChannel('salon');
      setGuildConfig(guildId, { notifyChannelId: channel.id });
      return interaction.reply({ content: `✅ Salon de notifications défini : ${channel}`, ephemeral: true });
    }


    if (sub === 'set_global_average') {
      const value = interaction.options.getInteger('value');
      setGuildConfig(guildId, { globalAverage: value });
      return interaction.reply({ content: `✅ Moyenne P2P globale définie : ${value}`, ephemeral: true });
    }

    if (sub === 'shop_role') {
      const role = interaction.options.getRole('role');
      setGuildConfig(guildId, { shopRoleId: role.id });
      return interaction.reply({ content: `✅ Rôle Shop VIP défini : ${role}`, ephemeral: true });
    }

    if (sub === 'shop_page_size') {
      const size = interaction.options.getInteger('size');
      setGuildConfig(guildId, { shopPageSize: size });
      return interaction.reply({ content: `✅ Taille de page du shop définie à : ${size}`, ephemeral: true });
    }

    if (sub === 'reset') {
      const { readData, writeData } = require('../utils/db');
      const all = readData('guild_configs.json', {});
      delete all[guildId];
      writeData('guild_configs.json', all);
      return interaction.reply({ content: '🔄 Configuration du serveur réinitialisée.', ephemeral: true });
    }
  }
};
