const { sendServerLog } = require('./serverLog');
const { readJSON, writeJSON } = require('./fileStore');
const logger = require('./logger');

const LOCKDOWN_FILE = 'antiRaidLockdowns.json';

const joinHistory = new Map(); // guildId -> array of timestamps
// Kilit durumu artık diske de yazılıyor — eskiden sadece RAM'de tutuluyordu, bot bir raid
// SIRASINDA (deploy/crash) yeniden başlarsa yönetici manuel açtığı kilit sessizce sıfırlanıyordu.
const lockdownGuilds = new Set(readJSON(LOCKDOWN_FILE, []));

function persistLockdowns() {
    writeJSON(LOCKDOWN_FILE, [...lockdownGuilds]);
}

const RAID_THRESHOLD_COUNT = 5; // küçük sunucular için taban değer
const RAID_TIME_WINDOW_MS = 10000; // 10 saniye

// Sabit eşik büyük sunucularda yanlış pozitif üretir (ör. bir influencer daveti sonrası 10sn'de
// 5+ kişinin katılması tamamen normaldir) — üye sayısına göre orantılıyoruz.
function getThreshold(guild) {
    return Math.max(RAID_THRESHOLD_COUNT, Math.ceil(guild.memberCount * 0.02));
}

function checkJoin(member) {
    const guild = member.guild;
    const now = Date.now();

    if (lockdownGuilds.has(guild.id)) {
        return { isRaid: true, isLockdown: true };
    }

    let joins = joinHistory.get(guild.id) || [];
    joins = joins.filter(t => now - t < RAID_TIME_WINDOW_MS);
    joins.push(now);
    joinHistory.set(guild.id, joins);

    if (joins.length >= getThreshold(guild)) {
        lockdownGuilds.add(guild.id);
        persistLockdowns();
        logger.warn(`[Anti-Raid] ${guild.name} sunucusunda olası RAID saldırısı tespit edildi! (${joins.length} giriş / 10sn)`);

        sendServerLog(guild, {
            title: '🚨 [ACİL DURUM] Anti-Raid Güvenlik Kalkanı Devrede!',
            color: 0xED4245,
            description: `Sunucuya son **10 saniye** içinde **${joins.length}** adet hesap katıldı! Olası bot/raid saldırısını önlemek için sunucu **Güvenlik Kilidi (Lockdown)** moduna alındı.`,
            fields: [
                { name: '🛡️ Güvenlik Önlemi', value: 'Yeni katılan şüpheli hesaplar karantinaya alınır.', inline: false },
                { name: '🔓 Kilidi Açmak İçin', value: 'Yöneticiler `/guvenlik-kilidi durum: Kapat` yazarak sunucuyu normale döndürebilir.', inline: false }
            ]
        }).catch(() => {});

        return { isRaid: true, isLockdown: true };
    }

    return { isRaid: false, isLockdown: false };
}

function setLockdown(guildId, active) {
    if (active) {
        lockdownGuilds.add(guildId);
    } else {
        lockdownGuilds.delete(guildId);
        joinHistory.delete(guildId);
    }
    persistLockdowns();
}

function isLockdown(guildId) {
    return lockdownGuilds.has(guildId);
}

module.exports = { checkJoin, setLockdown, isLockdown };
