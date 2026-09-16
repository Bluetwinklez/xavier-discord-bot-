const { Events, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getSettings } = require('../utils/database');
const { askOpenClaw, splitMessage, checkAiCooldown } = require('../utils/aiManager');
const { inspectMessage } = require('../utils/automod');
const { sendServerLog } = require('../utils/serverLog');
const { addXp } = require('../utils/levelSystem');
const { checkAndNotify: checkBadges } = require('../utils/badgeManager');
const { getAfk, clearAfk } = require('../utils/afkManager');
const { getPersona } = require('../utils/aiPersonas');
const logger = require('../utils/logger');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Botların mesajlarını yoksay
        if (message.author.bot) return;

        // Özel mesajları (DM) yoksay (sunucuda çalışsın)
        if (!message.guild) return;

        const settings = getSettings(message.guild.id);

        // AFK SİSTEMİ: yazan kişi AFK ise geri döndüğünü işaretle; mesajda AFK biri etiketlenmişse bilgi ver
        const authorAfk = getAfk(message.guild.id, message.author.id);
        if (authorAfk) {
            clearAfk(message.guild.id, message.author.id);
            message.reply(`👋 Tekrar hoş geldin ${message.author}, AFK durumun kaldırıldı.`)
                .then(m => setTimeout(() => m.delete().catch(() => {}), 8000))
                .catch(() => {});
        }
        if (message.mentions.users.size > 0) {
            const afkMentions = [];
            for (const [, user] of message.mentions.users) {
                if (user.bot || user.id === message.author.id) continue;
                const afk = getAfk(message.guild.id, user.id);
                if (afk) afkMentions.push(`💤 **${user.username}** şu an AFK: ${afk.reason}`);
            }
            if (afkMentions.length > 0) {
                message.reply(afkMentions.join('\n')).catch(() => {});
            }
        }

        // OTOMATİK MODERASYON: AI kanal kısıtlamasından ÖNCE çalışır, TÜM kanallarda geçerlidir.
        // OYUN KANALLARI KONTROLÜ (Kelime Türetmece & Sayı Saymaca)
        const { handleWordGame, handleCountingGame } = require('../utils/gameManager');
        if (await handleWordGame(message, settings)) return;
        if (await handleCountingGame(message, settings)) return;

        const violation = inspectMessage(message);
        if (violation) {
            try {
                await message.delete();
            } catch (err) {
                logger.error('Otomod: mesaj silinemedi:', err);
            }

            message.channel.send({
                content: `⚠️ ${message.author}, mesajın kaldırıldı: **${violation.reason}**`
            }).then(warnMsg => {
                setTimeout(() => warnMsg.delete().catch(() => {}), 6000);
            }).catch(() => {});

            sendServerLog(message.guild, {
                title: '🛡️ Otomod Müdahalesi',
                color: 0xE74C3C,
                description: violation.reason,
                fields: [
                    { name: '👤 Kullanıcı', value: `${message.author.tag}`, inline: true },
                    { name: '📍 Kanal', value: `${message.channel}`, inline: true }
                ]
            }).catch(() => {});
            return;
        }

        // settings moved to top

        // SEVİYE/XP SİSTEMİ: hangi kanalda olursa olsun her mesaj (kullanıcı başına 60sn'de bir) XP kazandırır.
        // Kod bloğu tespiti ve yardımcı butonlar
        const { attachCodeButtons } = require('../utils/codeHelper');
        attachCodeButtons(message).catch(() => {});

        if (settings.levelSystemEnabled !== false) {
            const newLevel = addXp(message.guild.id, message.author.id);
            if (newLevel !== null) {
                let roleAwardedText = '';
                if (settings.levelRoles && settings.levelRoles[newLevel]) {
                    const awardRoleId = settings.levelRoles[newLevel];
                    const role = message.guild.roles.cache.get(awardRoleId);
                    if (role && message.member) {
                        await message.member.roles.add(role).catch(() => {});
                        roleAwardedText = `\n🎖️ **Tebrikler!** ${role} rolü kazandın!`;
                    }
                }
                const embed = new EmbedBuilder()
                    .setColor(0xFEE75C)
                    .setDescription(`🎉 Tebrikler ${message.author}, **Seviye ${newLevel}**'e ulaştın!${roleAwardedText}`);
                const levelChannelId = settings.levelUpChannelId || message.channel.id;
                const levelChannel = message.guild.channels.cache.get(levelChannelId) || message.channel;
                levelChannel.send({ embeds: [embed] }).catch(() => {});
            }
            checkBadges(message.guild, message.member);
        }

        // 1. Dinamik Öğrenilen Özel Komutları Kontrol Et
        const { getGuildSkills } = require('../utils/customSkillManager');
        const guildSkills = getGuildSkills(message.guild.id);
        const lowerMsg = message.content.toLowerCase().trim();
        const customCmd = guildSkills.commands?.find(c => c.trigger === lowerMsg);
        if (customCmd) {
            return message.reply(customCmd.response);
        }

        // AI TETİKLEYİCİ KAPISI: botu ya doğrudan etiketlemiş olman ya da mesajın ayarlanmış AI
        // kanalında olması gerekir. Bu kontrol eskiden YOKTU — sonucunda botun bulunduğu HER
        // kanalda yazılan HER mesaj (hiç etiketlenmeden) doğrudan LLM'e gidiyordu; hem gereksiz
        // API maliyeti hem de aşağıdaki "niyet tahmini" (intent fallback) regex'leri üzerinden
        // (örn. "kanalları temizle" gibi gündelik bir cümle) istemsiz yıkıcı eylem tetikleme riski
        // yaratıyordu. /ai-kanal-ayarla ve /ai-rol-ayarla komutlarının vaat ettiği kısıtlamayı
        // burada da (slash komut /ai ile birebir aynı mantıkla) uyguluyoruz.
        const isMentioned = message.mentions.has(message.client.user);
        const isAiChannel = settings.aiChannelId && message.channel.id === settings.aiChannelId;
        if (!isMentioned && !isAiChannel) return;

        if (settings.aiRoleId) {
            const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
            const hasRole = message.member.roles.cache.has(settings.aiRoleId);
            if (!isAdmin && !hasRole) return;
        }

        // Mesaj metninden etiketleri ve uyandırma kelimelerini temizle
        const mentionRegex = new RegExp(`<@!?${message.client.user.id}>`, 'g');
        let cleanContent = message.content.replace(mentionRegex, '').trim();
        cleanContent = cleanContent.replace(/^(?:bot|xavier|master)[,\s.:;!?-]+/i, '').trim();

        if (!cleanContent) {
            const persona = getPersona(settings.aiPersona || 'gemini');
            if (persona.id === 'flirt') {
                return message.reply('Efendim canım? Seni dinliyorum! 💖');
            }
            return message.reply('Efendim? Seni dinliyorum! 😊');
        }

        // Spam / API maliyeti önleme: kullanıcı başına kısa bekleme süresi
        const cooldownMs = checkAiCooldown(message.author.id);
        if (cooldownMs > 0) {
            return message.reply(`⏳ Çok hızlı istek gönderiyorsun, ${Math.ceil(cooldownMs / 1000)} saniye bekle.`).catch(() => {});
        }

        try {
            // Yazıyor... göstergesi
            await message.channel.sendTyping();

            const contextId = `chan-${message.channel.id}-${message.author.id}`;
            const context = {
                guild: message.guild,
                channel: message.channel,
                member: message.member,
                client: message.client
            };
            const answer = await askOpenClaw(contextId, cleanContent, message.member?.displayName || message.author.username, context);

            const chunks = splitMessage(answer);
            await message.reply({ content: chunks[0] });

            for (let i = 1; i < chunks.length; i++) {
                await message.channel.send({ content: chunks[i] });
            }
        } catch (error) {
            console.error('Mesajla AI yanıtı verilirken hata:', error);
        }
    },
};
