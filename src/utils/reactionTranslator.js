const { EmbedBuilder } = require('discord.js');
const { callAIProviders } = require('./aiManager');
const logger = require('./logger');

const FLAG_LANGUAGES = {
    '🇬🇧': 'İngilizce',
    '🇺🇸': 'İngilizce',
    '🇹🇷': 'Türkçe',
    '🇩🇪': 'Almanca',
    '🇫🇷': 'Fransızca',
    '🇷🇺': 'Rusça',
    '🇪🇸': 'İspanyolca',
    '🇦🇿': 'Azerbaycan Türkçesi',
    '🇯🇵': 'Japonca',
    '🇮🇹': 'İtalyanca'
};

const translatedCache = new Set(); // messageId + emoji

async function handleReactionTranslation(reaction, user) {
    if (user.bot) return;

    const emoji = reaction.emoji.name;
    const targetLang = FLAG_LANGUAGES[emoji];
    if (!targetLang) return;

    try {
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();
    } catch (err) {
        return;
    }

    const message = reaction.message;
    if (!message.content || message.content.trim().length < 2) return;

    const cacheKey = `${message.id}:${emoji}`;
    if (translatedCache.has(cacheKey)) return;
    translatedCache.add(cacheKey);
    setTimeout(() => translatedCache.delete(cacheKey), 60000); // 1 dk cooldown

    const prompt = `Şu metni ${targetLang} diline çevir.
Yalnızca çeviriyi yaz, ekstra not veya tırnak ekleme:

Metin:
"${message.content}"`;

    try {
        const translated = await callAIProviders([
            { role: 'system', content: 'Sen profesyonel, akıcı bir dil çevirmenisin. Yalnızca hedef dildeki çevrilmiş metni döndür.' },
            { role: 'user', content: prompt }
        ]);

        if (!translated) return;

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setAuthor({
                name: `${message.author.tag} (${targetLang})`,
                iconURL: message.author.displayAvatarURL({ dynamic: true })
            })
            .setDescription(translated.slice(0, 2000))
            .setFooter({
                text: `${user.tag} tarafından istendi • ${emoji} Çeviri`,
                iconURL: user.displayAvatarURL({ dynamic: true })
            })
            .setTimestamp();

        await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    } catch (err) {
        logger.error('[ReactionTranslation] Çeviri hatası:', err.message);
    }
}

module.exports = { handleReactionTranslation };
