// Kademeli uyarı (warn) sistemi. Belirli sayıda uyarıya ulaşan üye otomatik olarak
// kısa süreliğine susturulur (escalation).
const { readJSON, writeJSON } = require('./fileStore');

const WARNS_FILE = 'warns.json';
const AUTO_TIMEOUT_THRESHOLD = 3; // Bu sayıda uyarıya ulaşınca otomatik timeout uygulanır
const AUTO_TIMEOUT_MINUTES = 10;

function loadAll() {
    return readJSON(WARNS_FILE, {});
}

function saveAll(data) {
    writeJSON(WARNS_FILE, data);
}

function addWarn(guildId, userId, moderatorId, reason) {
    const all = loadAll();
    if (!all[guildId]) all[guildId] = {};
    if (!all[guildId][userId]) all[guildId][userId] = [];

    // id = mevcut en yüksek id + 1 (dizi uzunluğu DEĞİL): "uzunluk + 1" kullanılırsa, ortadan bir
    // uyarı silindiğinde yeni eklenen uyarı, silinmeyen başka bir uyarıyla AYNI id'yi alabiliyordu
    // (örn. #1,#2,#3 varken #2 silinince uzunluk 2 olur, yeni uyarı #3 alır ve mevcut #3 ile çakışır)
    // — bu durumda tek bir /uyari-sil çağrısı yanlışlıkla iki farklı uyarıyı birden siliyordu.
    const maxId = all[guildId][userId].reduce((max, w) => Math.max(max, w.id), 0);
    const warn = {
        id: maxId + 1,
        moderatorId,
        reason: reason || 'Belirtilmedi',
        timestamp: Date.now()
    };
    all[guildId][userId].push(warn);
    saveAll(all);

    const count = all[guildId][userId].length;
    return { warn, count, shouldAutoTimeout: count > 0 && count % AUTO_TIMEOUT_THRESHOLD === 0 };
}

function getWarns(guildId, userId) {
    const all = loadAll();
    return all[guildId]?.[userId] || [];
}

function removeWarn(guildId, userId, warnId) {
    const all = loadAll();
    if (!all[guildId]?.[userId]) return false;
    const prevLen = all[guildId][userId].length;
    all[guildId][userId] = all[guildId][userId].filter(w => w.id !== Number(warnId));
    const changed = all[guildId][userId].length !== prevLen;
    if (changed) saveAll(all);
    return changed;
}

function clearWarns(guildId, userId) {
    const all = loadAll();
    if (!all[guildId]?.[userId]) return 0;
    const count = all[guildId][userId].length;
    all[guildId][userId] = [];
    saveAll(all);
    return count;
}

module.exports = { addWarn, getWarns, removeWarn, clearWarns, AUTO_TIMEOUT_THRESHOLD, AUTO_TIMEOUT_MINUTES };
