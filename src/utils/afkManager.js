// AFK (uzakta) durumu takip sistemi.
const { readJSON, writeJSON } = require('./fileStore');

const AFK_FILE = 'afk.json';

function loadAll() {
    return readJSON(AFK_FILE, {});
}

function saveAll(data) {
    writeJSON(AFK_FILE, data);
}

function setAfk(guildId, userId, reason) {
    const all = loadAll();
    if (!all[guildId]) all[guildId] = {};
    all[guildId][userId] = { reason: reason || 'Belirtilmedi', since: Date.now() };
    saveAll(all);
}

function getAfk(guildId, userId) {
    const all = loadAll();
    return all[guildId]?.[userId] || null;
}

function clearAfk(guildId, userId) {
    const all = loadAll();
    if (all[guildId]?.[userId]) {
        delete all[guildId][userId];
        saveAll(all);
        return true;
    }
    return false;
}

module.exports = { setAfk, getAfk, clearAfk };
