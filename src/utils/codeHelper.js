const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { callAIProviders } = require('./aiManager');
const logger = require('./logger');

function isLikelyCode(text) {
    if (!text || text.length < 25) return false;

    // Eğer zaten markdown kod bloğundaysa
    if (text.includes('```')) return true;

    // Kod belirteçleri
    const lines = text.split('\n');
    if (lines.length < 3) return false;

    const codeKeywords = [
        /\bfunction\b/, /\bconst\b/, /\blet\b/, /\bvar\b/, /\bdef\b/, /\bclass\b/,
        /\bimport\b/, /\brequire\(/, /\bconsole\.log\(/, /\bprint\(/, /\breturn\b/,
        /=>/, /\{[\s\S]*\}/, /<\/?[a-z][\s\S]*>/i, /;\s*$/m
    ];

    let matchCount = 0;
    for (const regex of codeKeywords) {
        if (regex.test(text)) matchCount++;
    }

    return matchCount >= 2;
}

async function attachCodeButtons(message) {
    if (message.author.bot) return;
    if (!isLikelyCode(message.content)) return;

    // Aşırı buton spamını önlemek için sadece belirgin kodlarda ekle
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`code_format:${message.id}`)
            .setLabel('Kodu Formatla')
            .setEmoji('✨')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`code_check:${message.id}`)
            .setLabel('Hata Ara')
            .setEmoji('🐞')
            .setStyle(ButtonStyle.Primary)
    );

    try {
        const reply = await message.reply({
            content: '💡 *Bu mesajda bir kod bloğu algılandı. Aşağıdaki araçları kullanabilirsiniz:*',
            components: [row]
        });
        // 5 dakika sonra butonları kaldır
        setTimeout(() => reply.delete().catch(() => {}), 300000);
    } catch (err) {
        logger.error('[codeHelper] Buton eklenemedi:', err.message);
    }
}

async function handleCodeButton(interaction) {
    if (!interaction.customId.startsWith('code_format:') && !interaction.customId.startsWith('code_check:')) {
        return false;
    }

    await interaction.deferReply({ ephemeral: true });

    const [action, targetMessageId] = interaction.customId.split(':');
    let targetMessage = null;

    try {
        targetMessage = await interaction.channel.messages.fetch(targetMessageId);
    } catch (err) {
        return interaction.editReply('❌ Orijinal kod mesajı bulunamadı veya silinmiş.');
    }

    const code = targetMessage.content.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();

    if (action === 'code_format') {
        const prompt = `Aşağıdaki kodu belirle, sözdizimini (syntax) ve girintilerini (indentation) mükemmel şekilde formatlayıp temiz markdown kod bloğu içinde döndür. Gereksiz açıklama ekleme, sadece temiz kodu ver:

Kod:
${code}`;

        const formatted = await callAIProviders([
            { role: 'system', content: 'Sen uzman bir kod formatlayıcı ve linter motorusun.' },
            { role: 'user', content: prompt }
        ]);

        const embed = new EmbedBuilder()
            .setColor(0x00FF88)
            .setTitle('✨ Formatlanmış Temiz Kod')
            .setDescription(formatted ? formatted.slice(0, 4000) : 'Kod formatlanamadı.')
            .setFooter({ text: `İsteyen: ${interaction.user.tag}` });

        return interaction.editReply({ embeds: [embed] });
    }

    if (action === 'code_check') {
        const prompt = `Aşağıdaki kodu kıdemli bir yazılım mühendisi gibi incele.
Varsa mantık hatalarını, potansiyel performans sorunlarını veya syntax hatalarını listele.
Eğer kod tamamen doğruysa 'Kod temiz ve sorunsuz görünüyor' de.

Kod:
${code}`;

        const review = await callAIProviders([
            { role: 'system', content: 'Sen titiz bir kıdemli kod denetçisi ve güvenlik uzmanısın.' },
            { role: 'user', content: prompt }
        ]);

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('🐞 Kod İnceleme & Hata Analizi')
            .setDescription(review ? review.slice(0, 4000) : 'Analiz yapılamadı.')
            .setFooter({ text: `Denetleyen: ${interaction.user.tag}` });

        return interaction.editReply({ embeds: [embed] });
    }

    return true;
}

module.exports = { attachCodeButtons, handleCodeButton };
