const { readData, writeData } = require('./db');

const FILE = 'guild_configs.json';

/**
 * Récupère la config d'un serveur spécifique.
 * @param {string} guildId
 * @returns {object}
 */
function getGuildConfig(guildId) {
  const all = readData(FILE, {});
  return all[guildId] || {};
}

/**
 * Met à jour un ou plusieurs champs de la config d'un serveur.
 * @param {string} guildId
 * @param {object} updates
 */
function setGuildConfig(guildId, updates) {
  const all = readData(FILE, {});
  all[guildId] = { ...(all[guildId] || {}), ...updates };
  writeData(FILE, all);
}

module.exports = { getGuildConfig, setGuildConfig };
