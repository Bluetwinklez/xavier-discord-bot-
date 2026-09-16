const { Collection } = require('discord.js');
const { readJSON, writeJSON } = require('./fileStore');
const { addBalance } = require('./economyManager');
const logger = require('./logger');

const FILE_NAME = 'invites.json';
const INVITE_REWARD = 100; // gerçek (fake olmayan) her davet için ekonomi ödülü
const invitesCache = new Map(); // guildId -> Collection(code -> uses)

// Guild başına bir "kuyruk" (promise zinciri): iki üye neredeyse aynı anda katılırsa, ikisi de
// `cached`'i okuyup `await guild.invites.fetch()` sırasında AYNI eski kopyayı görebiliyordu —
// bu da yanlış davet edene kredi verilmesine veya bir katılımın hiç sayılmamasına yol açabiliyordu.
// trackMemberJoin çağrılarını bu kilitle guild başına SIRAYLA çalıştırıyoruz.
const guildLocks = new Map(); // guildId -> Promise (zincirin son halkası)
function withGuildLock(guildId, fn) {
    const prev = guildLocks.get(guildId) || Promise.resolve();
    const run = prev.then(fn, fn);
    guildLocks.set(guildId, run.catch(() => {}));
    return run;
}

function loadInvitesData() {
    return readJSON(FILE_NAME, {});
}

function saveInvitesData(data) {
    return writeJSON(FILE_NAME, data);
}

async function cacheGuildInvites(guild) {
    try {
        if (!guild.members.me?.permissions.has('ManageGuild')) return;
        const guildInvites = await guild.invites.fetch();
        const codeUses = new Collection();
        guildInvites.forEach(inv => codeUses.set(inv.code, inv.uses));
        invitesCache.set(guild.id, codeUses);
    } catch (err) {
        logger.error(`[inviteTracker] ${guild.name} davetleri önbelleğe alınamadı:`, err.message);
    }
}

function trackMemberJoin(member) {
    return withGuildLock(member.guild.id, () => trackMemberJoinLocked(member));
}

async function trackMemberJoinLocked(member) {
    const guild = member.guild;
    const cached = invitesCache.get(guild.id);
    let usedInvite = null;

    try {
        if (guild.members.me?.permissions.has('ManageGuild')) {
            const currentInvites = await guild.invites.fetch();
            if (cached) {
                usedInvite = currentInvites.find(inv => {
                    const prevUses = cached.get(inv.code) || 0;
                    return inv.uses > prevUses;
                });
            }
            // Güncel uses'ları önbelleğe yaz
            const newCache = new Collection();
            currentInvites.forEach(inv => newCache.set(inv.code, inv.uses));
            invitesCache.set(guild.id, newCache);
        }
    } catch (err) {
        logger.error(`[inviteTracker] Davet kontrolü hatası:`, err.message);
    }

    const allData = loadInvitesData();
    if (!allData[guild.id]) allData[guild.id] = {};

    const isFake = (Date.now() - member.user.createdTimestamp) < (3 * 24 * 60 * 60 * 1000); // 3 günden yeni

    let inviterUser = null;
    let inviterStats = null;

    if (usedInvite && usedInvite.inviter) {
        inviterUser = usedInvite.inviter;
        const inviterId = inviterUser.id;

        if (!allData[guild.id][inviterId]) {
            allData[guild.id][inviterId] = { regular: 0, fake: 0, left: 0, members: {} };
        }

        const stats = allData[guild.id][inviterId];
        if (isFake) {
            stats.fake = (stats.fake || 0) + 1;
        } else {
            stats.regular = (stats.regular || 0) + 1;
            // Yeni özellik: davet sistemi eskiden sadece SAYIYORDU, hiçbir ödül vermiyordu.
            // Gerçek (fake olmayan) her davet için ekonomiye jeton ödülü ekleniyor.
            if (!inviterUser.bot) {
                addBalance(guild.id, inviterId, INVITE_REWARD);
            }
        }

        if (!stats.members) stats.members = {};
        stats.members[member.id] = { fake: isFake, joinedAt: Date.now() };

        saveInvitesData(allData);
        inviterStats = {
            regular: stats.regular || 0,
            fake: stats.fake || 0,
            left: stats.left || 0,
            total: (stats.regular || 0) - (stats.left || 0)
        };
    }

    return { inviterUser, inviterStats, isFake };
}

function trackMemberLeave(member) {
    const guild = member.guild;
    const allData = loadInvitesData();
    if (!allData[guild.id]) return null;

    for (const [inviterId, data] of Object.entries(allData[guild.id])) {
        if (data.members && data.members[member.id]) {
            data.left = (data.left || 0) + 1;
            delete data.members[member.id];
            saveInvitesData(allData);
            return inviterId;
        }
    }
    return null;
}

function getUserInvites(guildId, userId) {
    const allData = loadInvitesData();
    const stats = allData[guildId]?.[userId] || { regular: 0, fake: 0, left: 0 };
    const regular = stats.regular || 0;
    const left = stats.left || 0;
    const fake = stats.fake || 0;
    return {
        regular,
        fake,
        left,
        total: Math.max(0, regular - left)
    };
}

function getInviteLeaderboard(guildId, limit = 10) {
    const allData = loadInvitesData();
    const guildData = allData[guildId] || {};

    return Object.entries(guildData)
        .map(([userId, data]) => {
            const regular = data.regular || 0;
            const left = data.left || 0;
            const fake = data.fake || 0;
            const total = Math.max(0, regular - left);
            return { userId, total, regular, fake, left };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, limit);
}

module.exports = {
    cacheGuildInvites,
    trackMemberJoin,
    trackMemberLeave,
    getUserInvites,
    getInviteLeaderboard
};
