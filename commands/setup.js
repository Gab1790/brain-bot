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
      sub.setName('sheet_url')
        .setDescription('Configure le lien Google Sheets CSV pour les valeurs de trade (staff)')
        .addStringOption(opt =>
          opt.setName('url')
            .setDescription('URL CSV publié (Fichier → Partager → Publier sur le web → CSV)')
            .setRequired(true)
        )
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
      const sheetStatus = config.sheetUrl ? '✅ Configuré' : '❌ Non configuré';

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Configuration du serveur')
        .addFields(
          { name: '🛡️ Rôle Staff',      value: staffRole,    inline: true },
          { name: '🤝 Rôle Middleman',   value: mmRole,       inline: true },
          { name: '📁 Catégorie tickets',value: ticketCat,    inline: true },
          { name: '📋 Salon de logs',    value: logChannel,   inline: true },
          { name: '📊 Google Sheet',     value: sheetStatus,  inline: true }
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

    if (sub === 'sheet_url') {
      const url = interaction.options.getString('url').trim();
      if (!url.startsWith('https://docs.google.com/spreadsheets/')) {
        return interaction.reply({
          content:
            '❌ URL invalide. Elle doit commencer par `https://docs.google.com/spreadsheets/`\n' +
            '💡 Va dans ton Google Sheet → Fichier → Partager → Publier sur le web → Sélectionne ta feuille → CSV → Publie.',
          ephemeral: true,
        });
      }
      setGuildConfig(guildId, { sheetUrl: url });
      invalidateCache(guildId);
      return interaction.reply({
        content:
          '✅ Google Sheet configuré ! Les valeurs de trade seront rechargées automatiquement toutes les 5 minutes.\n' +
          '📊 Format attendu du sheet : `name | value | trend | updatedAt`',
        ephemeral: true,
      });
    }

    if (sub === 'set_global_average') {
      const value = interaction.options.getInteger('value');
      setGuildConfig(guildId, { globalAverage: value });
      return interaction.reply({ content: `✅ Moyenne P2P globale définie : ${value}`, ephemeral: true });
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
