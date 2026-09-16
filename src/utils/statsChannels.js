// Kendini güncelleyen istatistik ses kanalları (üye/bot/boost sayacı).
// Discord kanal adı değiştirmeyi rate-limitliyor (~2 değişim/10dk/kanal), bu yüzden
// güncelleme aralığı 10 dakikadan sık olmamalı.
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { getSettings, setSettings } = require('./database');
const logger = require('./logger');

const UPDATE_INTERVAL_MS = 10 * 60 * 1000;

async function setupStatsChannels(guild) {
    const category = await guild.channels.create({
        name: '📊 │ SUNUCU İSTATİSTİKLERİ',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.Connect] }
        ]
    });

    const memberChannel = await guild.channels.create({
        name: `👥 Üye: ${guild.memberCount}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.Connect] }]
    });

    const botCount = guild.members.cache.filter(m => m.user.bot).size;
    const botChannel = await guild.channels.create({
        name: `🤖 Bot: ${botCount}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.Connect] }]
    });

    const boostChannel = await guild.channels.create({
        name: `💎 Boost: ${guild.premiumSubscriptionCount || 0}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.Connect] }]
    });

    setSettings(guild.id, {
        statsChannels: {
            categoryId: category.id,
            memberChannelId: memberChannel.id,
            botChannelId: botChannel.id,
            boostChannelId: boostChannel.id
        }
    });

    return { category, memberChannel, botChannel, boostChannel };
}

async function removeStatsChannels(guild) {
    const settings = getSettings(guild.id);
    const stats = settings.statsChannels;
    if (!stats) return false;

    for (const id of [stats.memberChannelId, stats.botChannelId, stats.boostChannelId, stats.categoryId]) {
        const ch = guild.channels.cache.get(id);
        if (ch) await ch.delete().catch(() => {});
    }

    setSettings(guild.id, { statsChannels: null });
    return true;
}

async function updateGuildStats(guild) {
    const settings = getSettings(guild.id);
    const stats = settings.statsChannels;
    if (!stats) return;

    try {
        await guild.members.fetch();
    } catch {}

    const memberChannel = guild.channels.cache.get(stats.memberChannelId);
    const botChannel = guild.channels.cache.get(stats.botChannelId);
    const boostChannel = guild.channels.cache.get(stats.boostChannelId);

    const botCount = guild.members.cache.filter(m => m.user.bot).size;

    if (memberChannel) await memberChannel.setName(`👥 Üye: ${guild.memberCount}`).catch(() => {});
    if (botChannel) await botChannel.setName(`🤖 Bot: ${botCount}`).catch(() => {});
    if (boostChannel) await boostChannel.setName(`💎 Boost: ${guild.premiumSubscriptionCount || 0}`).catch(() => {});
}

function startStatsUpdateLoop(client) {
    const timer = setInterval(async () => {
        for (const guild of client.guilds.cache.values()) {
            const settings = getSettings(guild.id);
            if (settings.statsChannels) {
                await updateGuildStats(guild).catch(err => logger.error(`İstatistik güncelleme hatası (${guild.name}):`, err));
            }
        }
    }, UPDATE_INTERVAL_MS);
    if (timer.unref) timer.unref();
    return timer;
}

module.exports = { setupStatsChannels, removeStatsChannels, updateGuildStats, startStatsUpdateLoop };
