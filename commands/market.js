const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('market')
        .setDescription('Afficher les offres les plus récentes du serveur')
        .addStringOption(opt =>
            opt.setName('type')
                .setDescription("Filtrer par type d'offre")
                .addChoices(
                    { name: 'Tout', value: 'ALL' },
                    { name: 'Vente', value: 'SELL' },
                    { name: 'Achat', value: 'BUY' }
                )
        ),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const config = db.getConfig(guildId);
        const filter = interaction.options.getString('type') || 'ALL';

        const ads = db.getRecentAds(guildId, filter, 10);

        if (!ads.length) {
            return interaction.reply({
                content: "📭 Aucune offre trouvée sur ce serveur pour le moment.",
                ephemeral: true
            });
        }

        const filterLabel = filter === 'SELL' ? 'Ventes' : filter === 'BUY' ? 'Achats' : 'Toutes offres';

        const embed = new EmbedBuilder()
            .setTitle(`📊 Market — ${filterLabel} récentes`)
            .setColor(config.embed_color)
            .setDescription(`Voici les ${ads.length} dernière(s) offre(s) publiée(s) sur ce serveur.`)
            .setFooter({ text: `${interaction.guild.name} • Market`, iconURL: interaction.guild.iconURL() })
            .setTimestamp();

        ads.forEach((ad, index) => {
            const typeIcon = ad.type === 'SELL' ? '🛒 Vente' : '🔎 Recherche';
            const value =
                `📦 **Quantité :** ${ad.quantity}\n` +
                `💰 **Prix :** ${ad.min_price} - ${ad.max_price}\n` +
                `💳 **Paiement :** ${ad.payment}\n` +
                `🛡️ **Middleman :** ${ad.middleman}\n` +
                `👤 **Auteur :** <@${ad.user_id}>\n` +
                `🆔 \`${ad.id}\``;

            embed.addFields({
                name: `${index + 1}. ${typeIcon} — ${ad.item_name}`,
                value,
                inline: false
            });
        });

        // Discord limite à 5 boutons par ActionRow et 5 rows par message
        const rows = [];
        for (let i = 0; i < ads.length; i += 5) {
            const row = new ActionRowBuilder();
            ads.slice(i, i + 5).forEach((ad, j) => {
                const index = i + j;
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`mp_${ad.id}`)
                        .setLabel(`${ad.type === 'SELL' ? '💬' : '✅'} Offre #${index + 1}`)
                        .setStyle(ad.type === 'SELL' ? ButtonStyle.Primary : ButtonStyle.Success)
                );
            });
            rows.push(row);
        }

        await interaction.reply({ embeds: [embed], components: rows, ephemeral: false });
    }
};