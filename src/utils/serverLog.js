// Sunucu içi log kanalına (settings.logChannelId) olay embed'i gönderen ortak yardımcı.
const { EmbedBuilder } = require('discord.js');
const { getSettings } = require('./database');
const logger = require('./logger');

async function sendServerLog(guild, { title, description, color = 0x5865F2, fields = [], footer, files } = {}) {
    if (!guild) return;
    const settings = getSettings(guild.id);
    if (!settings.logChannelId) return;

    const channel = guild.channels.cache.get(settings.logChannelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setTimestamp();

    if (description) embed.setDescription(description);
    if (fields.length) embed.addFields(fields);
    if (footer) embed.setFooter({ text: footer });

    try {
        await channel.send({ embeds: [embed], files: files || undefined });
    } catch (err) {
        logger.error(`[serverLog] Log kanalına yazılamadı (guild: ${guild.id}):`, err);
    }
}

module.exports = { sendServerLog };
