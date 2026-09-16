// Kalıcı moderasyon geçmişi (ban/kick/timeout). Uyarılar ayrı warnManager'da tutulur;
// /moderasyon-gecmisi komutu ikisini birleştirip kronolojik gösterir.
const { readJSON, writeJSON } = require('./fileStore');

const HISTORY_FILE = 'modHistory.json';

function loadAll() {
    return readJSON(HISTORY_FILE, {});
}

function saveAll(data) {
    writeJSON(HISTORY_FILE, data);
}

function addModAction(guildId, userId, type, moderatorId, reason) {
    const all = loadAll();
    if (!all[guildId]) all[guildId] = {};
    if (!all[guildId][userId]) all[guildId][userId] = [];

    all[guildId][userId].push({
        type, // 'ban' | 'kick' | 'timeout'
        moderatorId,
        reason: reason || 'Belirtilmedi',
        timestamp: Date.now()
    });
    saveAll(all);
}

function getModHistory(guildId, userId) {
    const all = loadAll();
    return all[guildId]?.[userId] || [];
}

module.exports = { addModAction, getModHistory };
