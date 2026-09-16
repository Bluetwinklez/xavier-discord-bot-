// Butonla katılımlı, süreli çekiliş sistemi.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { readJSON, writeJSON } = require('./fileStore');

const GIVEAWAYS_FILE = 'giveaways.json';

const activeGiveaways = new Map(); // messageId -> { guildId, channelId, prize, winnerCount, endsAt, participants: Set, timeoutHandle, host }

// Eskiden bu tamamen RAM'de tutuluyordu: çekiliş devam ederken bot yeniden başlarsa (deploy/crash)
// hem veri hem de zamanlayıcı kaybolur, "Katıl" butonu ekranda kalmaya devam eder ama tıklayan
// kullanıcılara "bulunamadı" döner ve ödül ASLA dağıtılmaz. Artık her değişiklikte diske yazılıyor;
// bot açılışında `resumeGiveaways()` ile geri yükleniyor (bkz. src/events/ready.js).
function persist() {
    const serializable = [...activeGiveaways.values()].map(g => ({
        messageId: g.messageId,
        guildId: g.guildId,
        channelId: g.channelId,
        prize: g.prize,
        winnerCount: g.winnerCount,
        endsAt: g.endsAt,
        participants: [...g.participants],
        host: g.host
    }));
    writeJSON(GIVEAWAYS_FILE, serializable);
}

function buildGiveawayEmbed(giveaway, ended = false) {
    const embed = new EmbedBuilder()
        .setColor(ended ? 0x99AAB5 : 0xFEE75C)
        .setTitle(ended ? `🎉 ÇEKİLİŞ SONA ERDİ: ${giveaway.prize}` : `🎉 ÇEKİLİŞ: ${giveaway.prize}`)
        .addFields(
            { name: '🏆 Kazanan Sayısı', value: `${giveaway.winnerCount}`, inline: true },
            { name: '👥 Katılımcı', value: `${giveaway.participants.size}`, inline: true },
            { name: '🎗️ Başlatan', value: `${giveaway.host}`, inline: true }
        )
        .setTimestamp(giveaway.endsAt);

    embed.setDescription(ended
        ? 'Bu çekiliş sona erdi.'
        : `Katılmak için aşağıdaki butona tıkla!\nBitiş: <t:${Math.floor(giveaway.endsAt / 1000)}:R>`);

    return embed;
}

function buildJoinRow(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('giveaway_join')
            .setLabel('Katıl')
            .setEmoji('🎉')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled)
    );
}

async function startGiveaway(channel, { prize, durationMinutes, winnerCount, host }) {
    const endsAt = Date.now() + durationMinutes * 60 * 1000;

    const giveaway = {
        guildId: channel.guild.id,
        channelId: channel.id,
        prize,
        winnerCount,
        endsAt,
        participants: new Set(),
        host: `${host}`,
        client: channel.client
    };

    const message = await channel.send({
        embeds: [buildGiveawayEmbed(giveaway)],
        components: [buildJoinRow()]
    });

    giveaway.messageId = message.id;
    activeGiveaways.set(message.id, giveaway);

    giveaway.timeoutHandle = setTimeout(() => endGiveaway(message.id), durationMinutes * 60 * 1000);
    persist();

    return message;
}

function joinGiveaway(messageId, userId) {
    const giveaway = activeGiveaways.get(messageId);
    if (!giveaway) return { ok: false, reason: 'not_found' };
    if (giveaway.participants.has(userId)) return { ok: false, reason: 'already_joined', count: giveaway.participants.size };
    giveaway.participants.add(userId);
    persist();
    return { ok: true, count: giveaway.participants.size };
}

async function endGiveaway(messageId) {
    const giveaway = activeGiveaways.get(messageId);
    if (!giveaway) return null;

    clearTimeout(giveaway.timeoutHandle);
    activeGiveaways.delete(messageId);
    persist();

    const pool = [...giveaway.participants];
    const winners = [];
    for (let i = 0; i < giveaway.winnerCount && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        winners.push(pool.splice(idx, 1)[0]);
    }

    try {
        const channel = await giveaway.client.channels.fetch(giveaway.channelId);
        const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
        if (message) {
            await message.edit({ embeds: [buildGiveawayEmbed(giveaway, true)], components: [buildJoinRow(true)] }).catch(() => {});
        }

        const resultText = winners.length > 0
            ? `🎉 Tebrikler ${winners.map(id => `<@${id}>`).join(', ')}! **${giveaway.prize}** kazandınız!`
            : `😢 Çekilişe kimse katılmadığı için **${giveaway.prize}** için kazanan seçilemedi.`;

        await channel.send(resultText);
    } catch (err) {
        console.error('Çekiliş sonuçlandırma hatası:', err);
    }

    return winners;
}

function getGiveaway(messageId) {
    return activeGiveaways.get(messageId);
}

// Bot açılışında (ready event) çağrılır: diskten kaydedilen çekilişleri geri yükler, süresi zaten
// geçmiş olanları hemen sonuçlandırır, kalanlar için zamanlayıcıyı yeniden kurar.
function resumeGiveaways(client) {
    const saved = readJSON(GIVEAWAYS_FILE, []);
    if (saved.length === 0) return;

    const now = Date.now();
    for (const g of saved) {
        const giveaway = {
            guildId: g.guildId,
            channelId: g.channelId,
            prize: g.prize,
            winnerCount: g.winnerCount,
            endsAt: g.endsAt,
            participants: new Set(g.participants),
            host: g.host,
            client,
            messageId: g.messageId
        };
        activeGiveaways.set(g.messageId, giveaway);

        const remaining = g.endsAt - now;
        if (remaining <= 0) {
            endGiveaway(g.messageId).catch(err => console.error('Gecikmiş çekiliş sonuçlandırma hatası:', err));
        } else {
            giveaway.timeoutHandle = setTimeout(() => endGiveaway(g.messageId), remaining);
        }
    }
    console.log(`[Çekiliş] ${saved.length} kalıcı çekiliş geri yüklendi.`);
}

module.exports = { startGiveaway, joinGiveaway, endGiveaway, getGiveaway, resumeGiveaways };
