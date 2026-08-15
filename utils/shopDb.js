const { readData, writeData } = require('./db');

const FILE = 'shop_offers.json';

/**
 * Returns all shop data.
 */
function getAllShops() {
  return readData(FILE, {});
}

/**
 * Returns a user's shop for a specific guild.
 * @param {string} guildId 
 * @param {string} userId 
 * @returns {Array|Object} array of offers or object mapped by slot
 */
function getUserShop(guildId, userId) {
  const all = getAllShops();
  if (!all[guildId]) return {};
  return all[guildId][userId] || {};
}

/**
 * Sets an offer at a specific slot for a user.
 * @param {string} guildId 
 * @param {string} userId 
 * @param {number} slot 1-indexed
 * @param {object} offer { give: string, receive: string, createdAt: number }
 */
function setShopOffer(guildId, userId, slot, offer) {
  const all = getAllShops();
  if (!all[guildId]) all[guildId] = {};
  if (!all[guildId][userId]) all[guildId][userId] = {};
  
  // Overwrite or create
  if (offer) {
    offer.id = `${guildId}_${userId}_${slot}_${Date.now()}`;
  }
  
  all[guildId][userId][slot] = offer;
  writeData(FILE, all);
}

/**
 * Removes an offer from a specific slot.
 * @param {string} guildId 
 * @param {string} userId 
 * @param {number} slot 
 */
function removeShopOffer(guildId, userId, slot) {
  const all = getAllShops();
  if (all[guildId] && all[guildId][userId] && all[guildId][userId][slot]) {
    delete all[guildId][userId][slot];
    writeData(FILE, all);
  }
}

/**
 * Removes an offer by its unique ID.
 * @param {string} id 
 */
function removeOfferById(id) {
  const all = getAllShops();
  for (const guildId in all) {
    for (const userId in all[guildId]) {
      for (const slot in all[guildId][userId]) {
        if (all[guildId][userId][slot] && all[guildId][userId][slot].id === id) {
          delete all[guildId][userId][slot];
          writeData(FILE, all);
          return;
        }
      }
    }
  }
}

module.exports = {
  getAllShops,
  getUserShop,
  setShopOffer,
  removeShopOffer,
  removeOfferById
};
