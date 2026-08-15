const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getUserShop, setShopOffer, removeShopOffer, getAllShops } = require('../utils/shopDb');
const { getGuildConfig } = require('../utils/guildConfig');
const { getBrainrotImage } = require('../utils/fandomApi');
const { getSheetValues } = require('../utils/sheetValues');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Gérer et voir le shop de trades')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('Voir le shop global ou d\'un joueur spécifique')
        .addUserOption(opt => opt.setName('joueur').setDescription('Joueur spécifique (optionnel)'))
        .addIntegerOption(opt => opt.setName('page').setDescription('Page à afficher (défaut 1)'))
    )
    .addSubcommandGroup(group =>
      group.setName('edit')
        .setDescription('Modifier tes offres de shop')
        .addSubcommand(sub =>
          sub.setName('dashboard')
            .setDescription('Voir le panel de tes trades actuels')
        )
        .addSubcommand(sub =>
          sub.setName('add')
            .setDescription('Ajouter une offre à ton shop')
            .addStringOption(opt => opt.setName('donne').setDescription('Ce que tu donnes').setRequired(true).setAutocomplete(true))
            .addStringOption(opt => opt.setName('demande').setDescription('Ce que tu demandes').setRequired(true).setAutocomplete(true))
            .addIntegerOption(opt => opt.setName('position').setDescription('Emplacement spécifique (1, 2, 3...)').setRequired(false))
        )
        .addSubcommand(sub =>
          sub.setName('remove')
            .setDescription('Retirer une offre de ton shop')
            .addIntegerOption(opt => opt.setName('position').setDescription('Emplacement à vider').setRequired(true))
        )
    ),

  async autocomplete(interaction) {
    const { handleBrainrotAutocomplete } = require('../utils/autocomplete');
    await handleBrainrotAutocomplete(interaction, true);
  },

  async execute(interaction) {
    const subGroup = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const author = interaction.user;

    const config = getGuildConfig(guildId);
    const pageSize = config.shopPageSize || 5;
    const shopRoleId = config.shopRoleId;

    const hasVipRole = shopRoleId && interaction.member.roles.cache.has(shopRoleId);
    const maxPages = hasVipRole ? 2 : 1;
    const maxSlots = maxPages * pageSize;

    if (subGroup === 'edit') {
      const userShop = getUserShop(guildId, author.id);

      if (sub === 'dashboard') {
        const embed = new EmbedBuilder()
          .setTitle(`🛒 Ton Shop (${Object.keys(userShop).length}/${maxSlots} emplacements)`)
          .setColor(0x3498db)
          .setDescription(`Tu as droit à **${maxPages} page(s)** de **${pageSize} trades** chacune.`);

        for (let i = 1; i <= maxSlots; i++) {
          const offer = userShop[i];
          if (offer) {
            embed.addFields({ name: `Emplacement ${i}`, value: `**Donne :** ${offer.give}\n**Demande :** ${offer.receive}`, inline: false });
          } else {
            embed.addFields({ name: `Emplacement ${i}`, value: `*Vide*`, inline: false });
          }
        }
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (sub === 'add') {
        const giveRaw = interaction.options.getString('donne').trim();
        const receiveRaw = interaction.options.getString('demande').trim();
        let pos = interaction.options.getInteger('position');

        // Validation for money vs money
        const isMoney = (val) => !isNaN(Number(val));
        if (isMoney(giveRaw) && isMoney(receiveRaw)) {
          return interaction.reply({ content: '❌ Les échanges Argent contre Argent ne sont pas autorisés.', ephemeral: true });
        }

        // Find empty slot if no position given
        if (!pos) {
          for (let i = 1; i <= maxSlots; i++) {
            if (!userShop[i]) {
              pos = i;
              break;
            }
          }
        }

        if (!pos) {
          return interaction.reply({ content: `❌ Ton shop est plein (limite: ${maxSlots} emplacements).`, ephemeral: true });
        }
        if (pos < 1 || pos > maxSlots) {
          return interaction.reply({ content: `❌ Position invalide. Tu peux utiliser les emplacements 1 à ${maxSlots}.`, ephemeral: true });
        }

        // Add
        setShopOffer(guildId, author.id, pos, {
          give: giveRaw,
          receive: receiveRaw,
          createdAt: Date.now()
        });

        return interaction.reply({ content: `✅ Offre ajoutée à l'emplacement ${pos} : **${giveRaw}** ➔ **${receiveRaw}**.`, ephemeral: true });
      }

      if (sub === 'remove') {
        const pos = interaction.options.getInteger('position');
        if (!userShop[pos]) {
          return interaction.reply({ content: `❌ Il n'y a aucune offre à l'emplacement ${pos}.`, ephemeral: true });
        }
        removeShopOffer(guildId, author.id, pos);
        return interaction.reply({ content: `✅ L'offre à l'emplacement ${pos} a été retirée.`, ephemeral: true });
      }
    }

    if (sub === 'view') {
      await interaction.deferReply();
      const targetUser = interaction.options.getUser('joueur');
      let reqPage = interaction.options.getInteger('page') || 1;

      const allShops = getAllShops()[guildId] || {};
      let offersList = [];

      if (targetUser) {
        const uShop = allShops[targetUser.id] || {};
        for (const slot in uShop) {
          offersList.push({ userId: targetUser.id, ...uShop[slot] });
        }
      } else {
        for (const uid in allShops) {
          for (const slot in allShops[uid]) {
            offersList.push({ userId: uid, ...allShops[uid][slot] });
          }
        }
        // sort by newest
        offersList.sort((a, b) => b.createdAt - a.createdAt);
      }

      if (offersList.length === 0) {
        return interaction.editReply({ content: '❌ Aucune offre trouvée.' });
      }

      const totalPages = Math.ceil(offersList.length / pageSize);
      if (reqPage < 1) reqPage = 1;
      if (reqPage > totalPages) reqPage = totalPages;

      const startIndex = (reqPage - 1) * pageSize;
      const pageOffers = offersList.slice(startIndex, startIndex + pageSize);

      const isMoney = (val) => !isNaN(Number(val));
      const formatItem = (val) => isMoney(val) ? `**$${Number(val).toLocaleString('fr-FR')}** 💰` : val;

      const embeds = [];
      const components = [];

      // We will create one small embed per offer for better visual separation and thumbnail support
      for (const offer of pageOffers) {
        const offerEmbed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setAuthor({ name: `Vendeur: <@${offer.userId}>` })
          .setDescription(`**Offre:** ${formatItem(offer.give)}\n**Demande:** ${formatItem(offer.receive)}`);

        let thumbItem = null;
        if (!isMoney(offer.receive)) thumbItem = offer.receive;
        else if (!isMoney(offer.give)) thumbItem = offer.give;

        if (thumbItem) {
          const imgUrl = await getBrainrotImage(thumbItem);
          if (imgUrl) offerEmbed.setThumbnail(imgUrl);
        }

        embeds.push(offerEmbed);

        // Buttons for this specific offer
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`shop_val_${offer.id}`).setEmoji('✅').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`shop_dm_${offer.id}`).setEmoji('✉️').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`shop_rep_${offer.id}`).setEmoji('❌').setStyle(ButtonStyle.Danger)
        );
        components.push(row);
      }

      // Add a final embed for pagination if needed
      if (totalPages > 1) {
        embeds.push(new EmbedBuilder()
          .setColor(0x2f3136)
          .setFooter({ text: `Page ${reqPage} / ${totalPages} - ${offersList.length} offre(s) au total` })
        );
      } else {
        embeds[embeds.length - 1].setFooter({ text: `${offersList.length} offre(s) au total` });
      }

      return interaction.editReply({ embeds, components });
    }
  }
};
