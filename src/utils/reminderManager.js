// Zamanlanmış hatırlatıcı sistemi (dosya tabanlı, bot yeniden başlasa bile hatırlatıcılar kaybolmaz).
const { readJSON, writeJSON } = require('./fileStore');
const logger = require('./logger');

const REMINDERS_FILE = 'reminders.json';
const CHECK_INTERVAL_MS = 30 * 1000;

const DURATION_UNIT_MS = {
    sn: 1000, saniye: 1000,
    dk: 60 * 1000, dakika: 60 * 1000,
    saat: 60 * 60 * 1000, sa: 60 * 60 * 1000,
    gun: 24 * 60 * 60 * 1000, gün: 24 * 60 * 60 * 1000, g: 24 * 60 * 60 * 1000
};

// "10dk", "2 saat", "1gün" gibi kalıpları milisaniyeye çevirir; anlaşılamazsa null döner
function parseDuration(str) {
    const match = String(str).trim().toLowerCase().match(/^(\d+)\s*(sn|saniye|dk|dakika|saat|sa|gun|gün|g)$/i);
    if (!match) return null;
    const amount = parseInt(match[1], 10);
    const unitMs = DURATION_UNIT_MS[match[2]];
    if (!unitMs || amount <= 0) return null;
    return amount * unitMs;
}

function loadAll() {
    return readJSON(REMINDERS_FILE, []);
}

function saveAll(data) {
    writeJSON(REMINDERS_FILE, data);
}

function addReminder(guildId, channelId, userId, message, triggerAt) {
    const all = loadAll();
    const reminder = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        guildId, channelId, userId, message, triggerAt
    };
    all.push(reminder);
    saveAll(all);
    return reminder;
}

function removeReminder(id) {
    const all = loadAll();
    saveAll(all.filter(r => r.id !== id));
}

// Bir kullanıcının o sunucudaki bekleyen hatırlatıcılarını, en yakın zamanlıdan başlayarak döner
function getRemindersForUser(guildId, userId) {
    return loadAll()
        .filter(r => r.guildId === guildId && r.userId === userId)
        .sort((a, b) => a.triggerAt - b.triggerAt);
}

// Kullanıcı dostu kısa referans: id'nin son 6 karakteri (rastgele son ek) yeterince ayırt edici
function shortId(id) {
    return id.slice(-6);
}

// Kısa referansla VE sahiplik kontrolüyle hatırlatıcı bulur (başkasının hatırlatıcısı iptal edilemesin diye)
function findReminderByShortId(guildId, userId, ref) {
    const all = loadAll();
    return all.find(r => r.guildId === guildId && r.userId === userId && shortId(r.id) === ref.toLowerCase());
}

function startReminderCheckLoop(client) {
    const check = async () => {
        const all = loadAll();
        const now = Date.now();
        const due = all.filter(r => r.triggerAt <= now);
        if (due.length === 0) return;

        for (const reminder of due) {
            removeReminder(reminder.id);
            try {
                const channel = await client.channels.fetch(reminder.channelId).catch(() => null);
                if (channel) {
                    await channel.send(`⏰ <@${reminder.userId}> Hatırlatma zamanı: **${reminder.message}**`).catch(() => {});
                }
            } catch (err) {
                logger.error('Hatırlatıcı gönderilirken hata:', err);
            }
        }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    interval.unref();
}

module.exports = { parseDuration, addReminder, removeReminder, getRemindersForUser, shortId, findReminderByShortId, startReminderCheckLoop };
