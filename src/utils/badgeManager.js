// Rozet tanımlarının TEK kaynağı (rozetler.js burdan okur) + rozet kazanma anını tespit edip
// log kanalına otomatik bildirim atan yardımcı. Eskiden rozet listesi sadece /rozetler komutunda
// anlık hesaplanıyordu, kazanıldığı AN hiçbir bildirim yoktu.
const { readJSON, writeJSON } = require('./fileStore');
const { sendServerLog } = require('./serverLog');
const { getBalance } = require('./economyManager');
const { getRank } = require('./levelSystem');
const { getUserInvites } = require('./inviteTracker');

const SEEN_FILE = 'seenBadges.json';

function getAllBadges(guildId, userId, daysInServer) {
    const balance = getBalance(guildId, userId);
    const rankData = getRank(guildId, userId);
    const invites = getUserInvites(guildId, userId);

    return [
        { key: 'geveze', name: '💬 Geveze', desc: 'Seviye 5 veya üzeri ol', unlocked: (rankData?.level || 0) >= 5 },
        { key: 'milyoner', name: '💰 Milyoner', desc: '1.000 veya üzeri bakiye biriktir', unlocked: balance >= 1000 },
        { key: 'emektar', name: '👑 Sunucu Emektarı', desc: 'Sunucuda 14 günden uzun süre bulun', unlocked: daysInServer >= 14 },
        { key: 'elci', name: '📨 Topluluk Elçisi', desc: 'En az 3 gerçek üye davet et', unlocked: (invites?.total || 0) >= 3 },
        { key: 'kidemli', name: '🛡️ Kıdemli Üye', desc: 'Seviye 10 veya üzeri ol', unlocked: (rankData?.level || 0) >= 10 },
        { key: 'hosgeldin', name: '🐣 Hoş Geldin', desc: 'Sunucuya katılmış olmak', unlocked: true }
    ];
}

// Bir üyenin rozet durumunu son bilinen duruma karşı kontrol eder, yeni açılan rozet varsa
// log kanalına bildirim atar ve durumu kaydeder. member.joinedTimestamp gerektirir.
function checkAndNotify(guild, member) {
    try {
        if (!member || member.user?.bot) return;
        const daysInServer = member.joinedTimestamp ? Math.floor((Date.now() - member.joinedTimestamp) / (1000 * 60 * 60 * 24)) : 0;
        const badges = getAllBadges(guild.id, member.id, daysInServer);
        const unlockedKeys = badges.filter(b => b.unlocked).map(b => b.key);

        const seenAll = readJSON(SEEN_FILE, {});
        const seenKey = `${guild.id}:${member.id}`;
        const seen = seenAll[seenKey] || [];
        const newOnes = badges.filter(b => b.unlocked && !seen.includes(b.key));
        if (newOnes.length === 0) return;

        seenAll[seenKey] = unlockedKeys;
        writeJSON(SEEN_FILE, seenAll);

        for (const badge of newOnes) {
            sendServerLog(guild, {
                title: '🏆 Yeni Rozet Kazanıldı!',
                color: 0xF1C40F,
                description: `${member} **${badge.name}** rozetini kazandı!\n*${badge.desc}*`
            }).catch(() => {});
        }
    } catch {}
}

module.exports = { getAllBadges, checkAndNotify };
