// Basit sunucu içi ekonomi sistemi: bakiye, günlük ödül, çalışma, transfer, liderlik tablosu.
const { readJSON, writeJSON } = require('./fileStore');

const ECONOMY_FILE = 'economy.json';
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const WORK_COOLDOWN_MS = 60 * 60 * 1000;
const DAILY_AMOUNT = 250;
const WORK_MIN = 50;
const WORK_MAX = 200;

function loadAll() {
    return readJSON(ECONOMY_FILE, {});
}

function saveAll(data) {
    writeJSON(ECONOMY_FILE, data);
}

function ensureAccount(all, guildId, userId) {
    if (!all[guildId]) all[guildId] = {};
    if (!all[guildId][userId]) all[guildId][userId] = { balance: 0, lastDaily: 0, lastWork: 0 };
    return all[guildId][userId];
}

function getBalance(guildId, userId) {
    const all = loadAll();
    return all[guildId]?.[userId]?.balance || 0;
}

function addBalance(guildId, userId, amount) {
    const all = loadAll();
    const acc = ensureAccount(all, guildId, userId);
    acc.balance = Math.max(0, acc.balance + amount);
    saveAll(all);
    return acc.balance;
}

function claimDaily(guildId, userId) {
    const all = loadAll();
    const acc = ensureAccount(all, guildId, userId);
    const now = Date.now();
    if (now - acc.lastDaily < DAILY_COOLDOWN_MS) {
        return { ok: false, remainingMs: DAILY_COOLDOWN_MS - (now - acc.lastDaily) };
    }
    acc.lastDaily = now;
    acc.balance += DAILY_AMOUNT;
    saveAll(all);
    return { ok: true, amount: DAILY_AMOUNT, balance: acc.balance };
}

function work(guildId, userId) {
    const all = loadAll();
    const acc = ensureAccount(all, guildId, userId);
    const now = Date.now();
    if (now - acc.lastWork < WORK_COOLDOWN_MS) {
        return { ok: false, remainingMs: WORK_COOLDOWN_MS - (now - acc.lastWork) };
    }
    const amount = WORK_MIN + Math.floor(Math.random() * (WORK_MAX - WORK_MIN + 1));
    acc.lastWork = now;
    acc.balance += amount;
    saveAll(all);
    return { ok: true, amount, balance: acc.balance };
}

function transfer(guildId, fromId, toId, amount) {
    const all = loadAll();
    const fromAcc = ensureAccount(all, guildId, fromId);
    const toAcc = ensureAccount(all, guildId, toId);
    if (fromAcc.balance < amount) {
        return { ok: false, reason: 'insufficient', balance: fromAcc.balance };
    }
    fromAcc.balance -= amount;
    toAcc.balance += amount;
    saveAll(all);
    return { ok: true, fromBalance: fromAcc.balance, toBalance: toAcc.balance };
}

// Mağaza kataloğu: renkli isim rolleri. Ekonomiye harcama noktası (para sink'i) eklemek için —
// eskiden bakiye biriktirmenin transfer/kumar dışında hiçbir kullanım alanı yoktu.
const SHOP_ITEMS = [
    { id: 'renk_kirmizi', name: '🔴 Kırmızı İsim Rengi', price: 500, color: '#FF0000', roleName: '🔴 Kırmızı Üye' },
    { id: 'renk_mavi', name: '🔵 Mavi İsim Rengi', price: 500, color: '#3498DB', roleName: '🔵 Mavi Üye' },
    { id: 'renk_yesil', name: '🟢 Yeşil İsim Rengi', price: 500, color: '#2ECC71', roleName: '🟢 Yeşil Üye' },
    { id: 'renk_mor', name: '🟣 Mor İsim Rengi', price: 750, color: '#9B59B6', roleName: '🟣 Mor Üye' },
    { id: 'renk_pembe', name: '🩷 Pembe İsim Rengi', price: 750, color: '#FF6EB4', roleName: '🩷 Pembe Üye' },
    { id: 'renk_altin', name: '🟡 Altın İsim Rengi (VIP)', price: 2500, color: '#F1C40F', roleName: '🟡 Altın VIP' }
];

function getShopItems() {
    return SHOP_ITEMS;
}

function getShopItem(itemId) {
    return SHOP_ITEMS.find(i => i.id === itemId) || null;
}

// Sadece bakiyeyi düşer/kontrol eder — rolü oluşturup atamak komut tarafının işi (guild/member
// nesnelerine burada erişim yok, bu katman sadece economy.json'u yönetiyor).
function buyItem(guildId, userId, itemId) {
    const item = getShopItem(itemId);
    if (!item) return { ok: false, reason: 'not_found' };

    const all = loadAll();
    const acc = ensureAccount(all, guildId, userId);
    if (acc.balance < item.price) {
        return { ok: false, reason: 'insufficient', balance: acc.balance, item };
    }

    acc.balance -= item.price;
    acc.inventory = acc.inventory || [];
    acc.inventory.push(itemId);
    saveAll(all);
    return { ok: true, item, balance: acc.balance };
}

function getLeaderboard(guildId, limit = 10) {
    const all = loadAll();
    const guildData = all[guildId] || {};
    return Object.entries(guildData)
        .sort((a, b) => b[1].balance - a[1].balance)
        .slice(0, limit)
        .map(([userId, data], i) => ({ rank: i + 1, userId, balance: data.balance }));
}

module.exports = { getBalance, addBalance, claimDaily, work, transfer, getLeaderboard, getShopItems, getShopItem, buyItem, DAILY_AMOUNT, WORK_MIN, WORK_MAX };
