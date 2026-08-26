const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Obtenir le lien pour ajouter ce bot sur un autre serveur'),

    async execute(interaction) {
        const permissions = new PermissionsBitField([
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.ReadMessageHistory
        ]).bitfield.toString();

        const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${interaction.client.user.id}&scope=bot%20applications.commands&permissions=${permissions}`;

        const embed = new EmbedBuilder()
            .setTitle('🔗 Invite ce bot sur ton serveur')
            .setColor('#3498db')
            .setDescription(`[Clique ici pour ajouter le bot](${inviteUrl})\n\nUne fois ajouté, un administrateur doit lancer \`/setup\` pour configurer les salons.`);

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};