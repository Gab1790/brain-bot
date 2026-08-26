const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('boost')
        .setDescription('Mettre en avant une annonce pendant 24h (staff uniquement)')
        .addStringOption(opt => opt.setName('ad_id').setDescription("ID de l'annonce (ex: SELL-0001)").setRequired(true)),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const config = db.getConfig(guildId);

        const memberRoles = interaction.member.roles.cache.map(r => r.id);
        const isStaff = memberRoles.some(role => config.staff_roles.includes(role));
        const isAdmin = interaction.member.permissions.has('Administrator');

        if (!isStaff && !isAdmin) {
            return interaction.reply({ content: "❌ Tu n'as pas la permission d'utiliser cette commande.", ephemeral: true });
        }

        const adId = interaction.options.getString('ad_id').trim().toUpperCase();
        const ad = db.getAd(adId);

        if (!ad) {
            return interaction.reply({ content: `❌ Aucune annonce trouvée avec l'ID \`${adId}\`.`, ephemeral: true });
        }

        if (ad.guild_id !== guildId) {
            return interaction.reply({ content: "❌ Cette annonce n'appartient pas à ce serveur.", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const { expiresAt } = db.setAdBoost(adId);
        const expiresTimestamp = Math.floor(expiresAt / 1000);

        // Tente de mettre à jour le message original avec un badge ⭐
        if (ad.message_id && ad.channel_id) {
            try {
                const channel = await interaction.guild.channels.fetch(ad.channel_id);
                const message = await channel.messages.fetch(ad.message_id);
                const originalEmbed = message.embeds[0];

                if (originalEmbed) {
                    const boostedEmbed = EmbedBuilder.from(originalEmbed);
                    const currentTitle = originalEmbed.title || '';
                    if (!currentTitle.startsWith('⭐')) {
                        boostedEmbed.setTitle(`⭐ BOOSTÉ • ${currentTitle}`);
                    }
                    await message.edit({ embeds: [boostedEmbed] });
                }
            } catch (err) {
                console.error(`Impossible de mettre à jour le message boosté pour ${adId}:`, err.message);
                // On continue quand même : le boost est actif en base même si le message n'a pas pu être édité
            }
        }

        await interaction.editReply({
            content: `⭐ L'annonce \`${adId}\` est maintenant boostée jusqu'à <t:${expiresTimestamp}:F> (<t:${expiresTimestamp}:R>).`
        });
    }
};