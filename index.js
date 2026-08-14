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

client.login(process.env.DISCORD_TOKEN);