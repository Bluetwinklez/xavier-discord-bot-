// Doğum günü hatırlatıcı: üye kendi doğum gününü (ay/gün) kaydeder, o gün geldiğinde
// kutlama mesajı atılır ve o gün boyunca geçerli "🎂 Doğum Günü" rolü verilir.
const { EmbedBuilder } = require('discord.js');
const { readJSON, writeJSON } = require('./fileStore');
const { getSettings, setSettings } = require('./database');
const logger = require('./logger');

const BIRTHDAYS_FILE = 'birthdays.json';
const BIRTHDAY_ROLE_NAME = '🎂 Doğum Günü';

function loadAll() {
    return readJSON(BIRTHDAYS_FILE, {});
}

function saveAll(data) {
    writeJSON(BIRTHDAYS_FILE, data);
}

function setBirthday(guildId, userId, month, day) {
    const all = loadAll();
    if (!all[guildId]) all[guildId] = {};
    all[guildId][userId] = { month, day, lastAnnouncedDate: all[guildId][userId]?.lastAnnouncedDate || null };
    saveAll(all);
}

function getBirthday(guildId, userId) {
    const all = loadAll();
    return all[guildId]?.[userId] || null;
}

function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

async function ensureBirthdayRole(guild) {
    let role = guild.roles.cache.find(r => r.name === BIRTHDAY_ROLE_NAME);
    if (!role) {
        role = await guild.roles.create({ name: BIRTHDAY_ROLE_NAME, color: 0xFF69B4, hoist: true, reason: 'Doğum günü sistemi' });
    }
    return role;
}

// Tüm sunucularda bugün doğum günü olanları kontrol eder: kutlar + rol verir.
// Dünün doğum günü sahiplerinden rolü geri alır. Saatte bir çağrılması yeterlidir.
async function checkBirthdays(client) {
    const all = loadAll();
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const today = todayKey();

    for (const guild of client.guilds.cache.values()) {
        const settings = getSettings(guild.id);
        if (!settings.birthdayChannelId) continue;
        if (!all[guild.id]) continue;

        const role = await ensureBirthdayRole(guild).catch(() => null);
        if (!role) continue;

        // Rolü hâlâ taşıyan ama bugün doğum günü OLMAYANLARDAN geri al
        for (const [, member] of role.members) {
            const bday = all[guild.id][member.id];
            if (!bday || bday.month !== month || bday.day !== day) {
                await member.roles.remove(role).catch(() => {});
            }
        }

        // Bugün doğum günü olanları kutla
        for (const [userId, bday] of Object.entries(all[guild.id])) {
            if (bday.month !== month || bday.day !== day) continue;
            if (bday.lastAnnouncedDate === today) continue;

            try {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (!member) continue;

                await member.roles.add(role).catch(() => {});

                const channel = guild.channels.cache.get(settings.birthdayChannelId);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor(0xFF69B4)
                        .setTitle('🎂 İyi ki Doğdun!')
                        .setDescription(`${member} bugün doğum gününü kutluyor! 🎉🎈`)
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                        .setTimestamp();
                    await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
                }

                bday.lastAnnouncedDate = today;
            } catch (err) {
                logger.error(`Doğum günü kutlama hatası (${userId}):`, err);
            }
        }
    }

    saveAll(all);
}

function startBirthdayCheckLoop(client) {
    const timer = setInterval(() => checkBirthdays(client).catch(err => logger.error('Doğum günü kontrol hatası:', err)), 60 * 60 * 1000);
    if (timer.unref) timer.unref();
    checkBirthdays(client).catch(() => {}); // Açılışta bir kez de kontrol et
    return timer;
}

module.exports = { setBirthday, getBirthday, checkBirthdays, startBirthdayCheckLoop, ensureBirthdayRole };
