# 🤖 Brainrot Trade Bot

Bot Discord multi-usages pour une communauté de trade Roblox (type Brainrot).

## Fonctionnalités

- 💰 **Values** : `/value`, `/addvalue` — base de valeurs des items
- 🔄 **Trade calculator** : `/tradecalc` — compare deux offres
- 🛡️ **Middleman** : `/mm` — ouvre un ticket privé avec le rôle Middleman
- 🎫 **Tickets support** : `/ticket` — support général
- ⭐ **Réputation** : `/vouch`, `/reputation` — système de vouches
- 🚫 **Blacklist** : `/blacklist` — liste noire des scammeurs (staff only)
- 📖 `/help` — liste des commandes

## 1. Créer l'application Discord

1. Va sur https://discord.com/developers/applications
2. **New Application** → donne un nom à ton bot
3. Onglet **Bot** → **Reset Token** → copie le token (garde-le secret !)
4. Active les **Privileged Gateway Intents** : `SERVER MEMBERS INTENT`
5. Onglet **OAuth2 > URL Generator** :
   - Scopes : `bot`, `applications.commands`
   - Permissions : `Manage Channels`, `Send Messages`, `Embed Links`, `Manage Roles` (pour les tickets), `Read Message History`
6. Copie l'URL générée et ouvre-la dans ton navigateur pour inviter le bot sur ton serveur

## 2. Configuration locale

```bash
cd brainrot-bot
npm install
cp .env.example .env
```

Remplis le fichier `.env` :
```
DISCORD_TOKEN=ton_token_bot
CLIENT_ID=id_de_ton_application
GUILD_ID=id_de_ton_serveur
MIDDLEMAN_ROLE_ID=id_du_role_middleman
STAFF_ROLE_ID=id_du_role_staff
TICKET_CATEGORY_ID=id_de_la_categorie_tickets   # optionnel
LOG_CHANNEL_ID=id_du_salon_logs                  # optionnel
```

> Pour récupérer un ID : Discord > Paramètres > Avancé > Mode développeur (activer), puis clic droit sur le serveur/rôle/salon > "Copier l'identifiant".

## 3. Déployer les commandes puis lancer le bot

```bash
npm run deploy   # à faire une fois (et à chaque ajout/modif de commande)
npm start        # lance le bot
```

## 4. Hébergement 24/7

### Option A — VPS (recommandé, ~5€/mois : Hetzner, Contabo)
```bash
# Sur le VPS (Ubuntu)
sudo apt update && sudo apt install nodejs npm -y
npm install -g pm2

# Copie ton projet sur le VPS, puis :
cd brainrot-bot
npm install
npm run deploy
pm2 start index.js --name brainrot-bot
pm2 save
pm2 startup   # pour redémarrage auto au reboot du serveur
```

### Option B — Railway (gratuit avec limites, simple)
1. Crée un compte sur https://railway.app
2. **New Project** → **Deploy from GitHub repo** (pousse d'abord ce projet sur GitHub)
3. Dans les **Variables**, ajoute toutes les valeurs de ton `.env`
4. Railway installe et lance automatiquement (`npm start`)
5. ⚠️ Fais un `npm run deploy` en local une fois pour enregistrer les commandes (ou ajoute-le en script de build)

## Structure du projet

```
brainrot-bot/
├── index.js              # point d'entrée du bot
├── deploy-commands.js    # enregistre les slash commands
├── commands/             # une commande = un fichier
├── events/
│   └── buttonHandler.js  # gère les boutons (tickets)
├── utils/
│   └── db.js             # lecture/écriture JSON
└── data/                 # stockage (values, vouches, blacklist)
```

## Aller plus loin

- Remplacer le stockage JSON par une vraie base (SQLite, MongoDB) si la communauté grossit
- Ajouter un système d'XP/niveaux
- Ajouter une modération auto (anti-spam, anti-lien)
- Ajouter des logs de trade horodatés en base pour arbitrage de litiges
