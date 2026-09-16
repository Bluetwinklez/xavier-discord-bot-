// Belirli sayıda ⭐ (veya ayarlanan emoji) tepki alan mesajları özel bir kanalda öne çıkarır.
const { EmbedBuilder } = require('discord.js');
const { getSettings, setSettings } = require('./database');
const { readJSON, writeJSON } = require('./fileStore');

const POSTED_FILE = 'starboardPosts.json'; // guildId -> { originalMessageId: starboardMessageId }

function loadPosted() {
    return readJSON(POSTED_FILE, {});
}

function savePosted(data) {
    writeJSON(POSTED_FILE, data);
}

// `posted` bir kere okunup birkaç `await`ten (fetch/send/edit) sonra bütünüyle geri yazılıyordu.
// İki farklı mesaj neredeyse aynı anda eşiği geçerse, ikisi de await sırasında AYNI eski kopyayı
// okuyabiliyor; hangisi önce yazarsa diğerininkini SİLİYORDU (lost update) — bu da aynı mesaj için
// ikinci bir starboard gönderisi (mükerrer embed) oluşturulmasına yol açıyordu. Yazmadan hemen önce
// dosyayı TAZE okuyup sadece kendi anahtarımızı güncelleyerek bu kayıp pencereyi kapatıyoruz.
function updatePostedEntry(guildId, messageId, starboardMessageId) {
    const fresh = loadPosted();
    if (!fresh[guildId]) fresh[guildId] = {};
    if (starboardMessageId) {
        fresh[guildId][messageId] = starboardMessageId;
    } else {
        delete fresh[guildId][messageId];
    }
    savePosted(fresh);
}

function buildStarboardEmbed(message, count, emoji) {
    const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setAuthor({ name: message.author?.tag || 'Bilinmeyen', iconURL: message.author?.displayAvatarURL?.() })
        .setDescription(message.content || '*(metin yok)*')
        .addFields({ name: 'Kaynak', value: `[Mesaja git](${message.url})`, inline: true })
        .setFooter({ text: `${emoji} ${count}` })
        .setTimestamp(message.createdAt);

    const image = message.attachments.find(a => a.contentType?.startsWith('image/'));
    if (image) embed.setImage(image.url);

    return embed;
}

async function handleReactionChange(reaction, user) {
    if (user.bot) return;
    if (reaction.partial) {
        try { await reaction.fetch(); } catch { return; }
    }

    const message = reaction.message;
    if (!message.guild) return;

    const settings = getSettings(message.guild.id);
    if (!settings.starboardChannelId) return;

    const emoji = settings.starboardEmoji || '⭐';
    if (reaction.emoji.name !== emoji) return;
    if (message.channel.id === settings.starboardChannelId) return; // Starboard kanalındaki mesajları tekrar starboard'a alma

    const threshold = settings.starboardThreshold || 3;
    const count = reaction.count || 0;

    const posted = loadPosted();
    if (!posted[message.guild.id]) posted[message.guild.id] = {};
    const existingStarboardId = posted[message.guild.id][message.id];

    const starboardChannel = message.guild.channels.cache.get(settings.starboardChannelId);
    if (!starboardChannel) return;

    if (count >= threshold) {
        const embed = buildStarboardEmbed(message, count, emoji);
        if (existingStarboardId) {
            const starMsg = await starboardChannel.messages.fetch(existingStarboardId).catch(() => null);
            if (starMsg) {
                await starMsg.edit({ embeds: [embed] }).catch(() => {});
                return;
            }
        }
        const sent = await starboardChannel.send({ content: `${emoji} **${count}** | ${message.channel}`, embeds: [embed] }).catch(() => null);
        if (sent) {
            updatePostedEntry(message.guild.id, message.id, sent.id);
        }
    } else if (existingStarboardId) {
        // Eşiğin altına düştü: starboard mesajını sil
        const starMsg = await starboardChannel.messages.fetch(existingStarboardId).catch(() => null);
        if (starMsg) await starMsg.delete().catch(() => {});
        updatePostedEntry(message.guild.id, message.id, null);
    }
}

function setupStarboard(guildId, channelId, threshold, emoji) {
    setSettings(guildId, {
        starboardChannelId: channelId,
        starboardThreshold: threshold || 3,
        starboardEmoji: emoji || '⭐'
    });
}

module.exports = { handleReactionChange, setupStarboard };
