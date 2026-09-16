// Mesaj bazlı seviye/XP sistemi (Mee6 tarzı XP formülü).
const { readJSON, writeJSON } = require('./fileStore');

const LEVELS_FILE = 'levels.json';
const XP_COOLDOWN_MS = 60 * 1000; // Spam-XP önleme: kullanıcı başına 60sn'de 1 mesaj XP kazandırır
const lastXpAt = new Map(); // "guildId:userId" -> timestamp

function xpForLevel(level) {
    return 5 * level * level + 50 * level + 100;
}

function loadAll() {
    return readJSON(LEVELS_FILE, {});
}

function saveAll(data) {
    writeJSON(LEVELS_FILE, data);
}

function getUserData(guildId, userId) {
    const all = loadAll();
    return all[guildId]?.[userId] || { xp: 0, level: 0 };
}

// Mesaj karşılığı XP ekler. Cooldown içindeyse hiçbir şey yapmaz. Seviye atlarsa yeni seviyeyi döner.
function addXp(guildId, userId) {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const last = lastXpAt.get(key);
    if (last && now - last < XP_COOLDOWN_MS) return null;
    lastXpAt.set(key, now);

    const all = loadAll();
    if (!all[guildId]) all[guildId] = {};
    if (!all[guildId][userId]) all[guildId][userId] = { xp: 0, level: 0 };

    const gained = 15 + Math.floor(Math.random() * 11); // 15-25 XP
    all[guildId][userId].xp += gained;

    let leveledUp = false;
    while (all[guildId][userId].xp >= xpForLevel(all[guildId][userId].level)) {
        all[guildId][userId].xp -= xpForLevel(all[guildId][userId].level);
        all[guildId][userId].level += 1;
        leveledUp = true;
    }

    saveAll(all);
    return leveledUp ? all[guildId][userId].level : null;
}

function getRank(guildId, userId) {
    const all = loadAll();
    const guildData = all[guildId] || {};
    const entries = Object.entries(guildData).sort((a, b) => {
        if (b[1].level !== a[1].level) return b[1].level - a[1].level;
        return b[1].xp - a[1].xp;
    });
    const position = entries.findIndex(([id]) => id === userId);
    const data = guildData[userId] || { xp: 0, level: 0 };
    return {
        xp: data.xp,
        level: data.level,
        xpNeeded: xpForLevel(data.level),
        rank: position >= 0 ? position + 1 : entries.length + 1,
        totalRanked: entries.length
    };
}

function getLeaderboard(guildId, limit = 10) {
    const all = loadAll();
    const guildData = all[guildId] || {};
    return Object.entries(guildData)
        .sort((a, b) => (b[1].level !== a[1].level ? b[1].level - a[1].level : b[1].xp - a[1].xp))
        .slice(0, limit)
        .map(([userId, data], i) => ({ rank: i + 1, userId, level: data.level, xp: data.xp }));
}

module.exports = { addXp, getRank, getLeaderboard, xpForLevel };
