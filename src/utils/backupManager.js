// Sunucu yapısı (roller + kategori/kanal ağacı) yedekleme ve geri yükleme.
// Geri yükleme EKLEYİCİDİR (additive): sadece backup'ta olup şu an sunucuda İSİM olarak
// bulunmayan rol/kanalları yeniden oluşturur; mevcut hiçbir şeyi silmez veya değiştirmez.
const { ChannelType } = require('discord.js');
const { readJSON, writeJSON } = require('./fileStore');

const BACKUPS_FILE = 'backups.json';
const MAX_BACKUPS_PER_GUILD = 5;

function loadAll() {
    return readJSON(BACKUPS_FILE, {});
}

function saveAll(data) {
    writeJSON(BACKUPS_FILE, data);
}

// İzin override'larını rol İSMİYLE saklıyoruz (rol ID'siyle değil): geri yükleme sırasında rol de
// silinmiş olabilir ve yeniden oluşturulan rolün ID'si eskisinden FARKLI olur — isimle eşleştirmek
// bu durumda da doğru rolü bulmamızı sağlıyor. @everyone ve kullanıcıya özel override'lar da destekleniyor.
function serializeOverwrites(channel, guild) {
    return channel.permissionOverwrites.cache.map(ow => {
        const entry = { allow: ow.allow.bitfield.toString(), deny: ow.deny.bitfield.toString() };
        if (ow.id === guild.id) {
            entry.target = 'everyone';
        } else {
            const role = guild.roles.cache.get(ow.id);
            if (role) {
                entry.target = 'role';
                entry.roleName = role.name;
            } else {
                entry.target = 'member';
                entry.userId = ow.id;
            }
        }
        return entry;
    });
}

function resolveOverwrites(savedOverwrites, guild) {
    const result = [];
    for (const ow of savedOverwrites || []) {
        let id;
        if (ow.target === 'everyone') id = guild.id;
        else if (ow.target === 'role') {
            const role = guild.roles.cache.find(r => r.name === ow.roleName);
            if (!role) continue; // O isimde rol artık yok, bu override'ı atla
            id = role.id;
        } else if (ow.target === 'member') {
            id = ow.userId;
        }
        if (!id) continue;
        result.push({ id, allow: BigInt(ow.allow), deny: BigInt(ow.deny) });
    }
    return result;
}

function createBackup(guild) {
    const roles = guild.roles.cache
        .filter(r => !r.managed && r.id !== guild.id)
        .map(r => ({
            name: r.name,
            color: r.color,
            hoist: r.hoist,
            permissions: r.permissions.bitfield.toString(),
            position: r.position
        }))
        .sort((a, b) => b.position - a.position);

    const categories = [];
    for (const cat of guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).values()) {
        const channels = guild.channels.cache
            .filter(c => c.parentId === cat.id && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice))
            .map(c => ({
                name: c.name, type: c.type, topic: c.topic || null, userLimit: c.userLimit || 0,
                permissionOverwrites: serializeOverwrites(c, guild)
            }));
        categories.push({ name: cat.name, channels });
    }

    const orphanChannels = guild.channels.cache
        .filter(c => !c.parentId && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice))
        .map(c => ({
            name: c.name, type: c.type, topic: c.topic || null, userLimit: c.userLimit || 0,
            permissionOverwrites: serializeOverwrites(c, guild)
        }));

    const backup = {
        id: Date.now(),
        createdAt: Date.now(),
        guildName: guild.name,
        roles,
        categories,
        orphanChannels
    };

    const all = loadAll();
    if (!all[guild.id]) all[guild.id] = [];
    all[guild.id].unshift(backup);
    all[guild.id] = all[guild.id].slice(0, MAX_BACKUPS_PER_GUILD);
    saveAll(all);

    return backup;
}

function listBackups(guildId) {
    const all = loadAll();
    return (all[guildId] || []).map(b => ({
        id: b.id,
        createdAt: b.createdAt,
        roleCount: b.roles.length,
        channelCount: b.categories.reduce((sum, c) => sum + c.channels.length, 0) + b.orphanChannels.length
    }));
}

function getBackup(guildId, backupId) {
    const all = loadAll();
    return (all[guildId] || []).find(b => b.id === Number(backupId));
}

async function restoreBackup(guild, backupId) {
    const backup = getBackup(guild.id, backupId);
    if (!backup) return null;

    let rolesCreated = 0;
    let channelsCreated = 0;

    for (const r of backup.roles) {
        const exists = guild.roles.cache.find(role => role.name === r.name);
        if (exists) continue;
        try {
            await guild.roles.create({
                name: r.name,
                color: r.color,
                hoist: r.hoist,
                permissions: BigInt(r.permissions),
                reason: 'Sunucu yedeğinden geri yükleme'
            });
            rolesCreated++;
        } catch {}
    }

    for (const cat of backup.categories) {
        let categoryChannel = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === cat.name);
        if (!categoryChannel) {
            try {
                categoryChannel = await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory, reason: 'Sunucu yedeğinden geri yükleme' });
            } catch {
                continue;
            }
        }
        for (const ch of cat.channels) {
            const exists = guild.channels.cache.find(c => c.name === ch.name && c.parentId === categoryChannel.id);
            if (exists) continue;
            try {
                await guild.channels.create({
                    name: ch.name,
                    type: ch.type,
                    parent: categoryChannel.id,
                    topic: ch.topic || undefined,
                    userLimit: ch.userLimit || undefined,
                    permissionOverwrites: resolveOverwrites(ch.permissionOverwrites, guild),
                    reason: 'Sunucu yedeğinden geri yükleme'
                });
                channelsCreated++;
            } catch {}
        }
    }

    for (const ch of backup.orphanChannels) {
        const exists = guild.channels.cache.find(c => c.name === ch.name && !c.parentId);
        if (exists) continue;
        try {
            await guild.channels.create({
                name: ch.name,
                type: ch.type,
                topic: ch.topic || undefined,
                userLimit: ch.userLimit || undefined,
                permissionOverwrites: resolveOverwrites(ch.permissionOverwrites, guild),
                reason: 'Sunucu yedeğinden geri yükleme'
            });
            channelsCreated++;
        } catch {}
    }

    return { rolesCreated, channelsCreated };
}

module.exports = { createBackup, listBackups, getBackup, restoreBackup };
