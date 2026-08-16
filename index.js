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
const db = require('./utils/db');

// Initialiser la DB
db.getDb();

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

const { REST, Routes } = require('discord.js');

client.once('ready', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  
  // -- Déploiement Automatique des Commandes --
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const commandData = client.commands.map(cmd => cmd.data.toJSON());
    
    console.log(`🔄 Déploiement automatique de ${commandData.length} commande(s)...`);
    
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commandData }
    );
    console.log("✅ Commandes déployées avec succès sur l'API Discord !");
  } catch (error) {
    console.error('❌ Erreur lors du déploiement des commandes :', error);
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

    if (interaction.isButton()) {
      await handleButton(interaction);
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

const fetch = require("node-fetch");

// ID du salon vocal à mettre à jour
const VOICE_CHANNEL_ID = "1538549668978622606";

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