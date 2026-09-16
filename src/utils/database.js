const { readJSON, writeJSON } = require('./fileStore');

const DB_FILE = 'settings.json';

function getSettings(guildId) {
    const data = readJSON(DB_FILE, {});
    return data[guildId] || {};
}

function setSettings(guildId, newSettings) {
    const data = readJSON(DB_FILE, {});
    data[guildId] = { ...(data[guildId] || {}), ...newSettings };
    const ok = writeJSON(DB_FILE, data);
    return ok ? data[guildId] : null;
}

module.exports = { getSettings, setSettings };
