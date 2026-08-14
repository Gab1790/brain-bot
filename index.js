require('dotenv').config();

// --- Mini serveur web pour empêcher Render de mettre le bot en veille ---
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot en ligne !');
}).listen(PORT, () => {
  console.log(`Serveur keep-alive actif sur le port ${PORT}`);
});
// --- Fin du mini serveur web ---

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const handleButton = require('./events/buttonHandler');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  // Run expiration job at startup and every 6 hours
  try {
    const { expireTrades } = require('./utils/expireTrades');
    expireTrades(client, 7).catch(() => {});
    setInterval(() => expireTrades(client, 7).catch(() => {}), 6 * 60 * 60 * 1000);
  } catch (e) {
    console.error('expireTrades not available', e);
  }
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;
      await command.autocomplete(interaction);
      return;
    }

    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }

      if (interaction.isModalSubmit && interaction.customId && interaction.customId.startsWith('message_modal_')) {
        const handleModal = require('./events/modalHandler');
        await handleModal(interaction);
        return;
      }
    } catch (err) {
    console.error(err);
    if (interaction.isRepliable()) {
      const payload = { content: "❌ Une erreur est survenue.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  }
});

import fetch from "node-fetch";

// ID du salon vocal à mettre à jour
const VOICE_CHANNEL_ID = "1537968234177888356";

// URL de ton API Render
const API_URL = "https://youtube-api-e8op.onrender.com/";

async function updateYoutubeStats(client) {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    const subs = data?.data?.count;
    if (!subs) return console.log("Impossible de récupérer les abonnés");

    const channel = client.channels.cache.get(VOICE_CHANNEL_ID);
    if (!channel) return console.log("Salon introuvable");

    await channel.setName(`📊 Abonnés YouTube : ${subs}`);
    console.log("Salon mis à jour :", subs);

  } catch (err) {
    console.error("Erreur mise à jour YouTube :", err);
  }
}

// Mise à jour toutes les 5 minutes
client.once("ready", () => {
  console.log("Mise à jour YouTube activée");

  updateYoutubeStats(client); // première mise à jour

  setInterval(() => {
    updateYoutubeStats(client);
  }, 5 * 60 * 1000);
});


client.login(process.env.DISCORD_TOKEN);