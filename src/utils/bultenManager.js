const { ChannelType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { callAIProviders } = require('./aiManager');
const logger = require('./logger');

const BULLETIN_CHANNEL_NAME = '📰┃haftalik-bulten';

async function getOrCreateBulletinChannel(guild) {
    let channel = guild.channels.cache.find(
        c => c.type === ChannelType.GuildText && (c.name.includes('haftalik-bulten') || c.name.includes('bulten') || c.name.includes('gazete'))
    );

    if (!channel) {
        channel = await guild.channels.create({
            name: BULLETIN_CHANNEL_NAME,
            type: ChannelType.GuildText,
            topic: '📰 Haftalık Sunucu Gazetesi, Teknoloji Gündemi ve Topluluk Bülteni',
            permissionOverwrites: [
                {
                    id: guild.id, // @everyone okuyabilir ama mesaj yazamaz (duyuru panosu gibi)
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions],
                    deny: [PermissionFlagsBits.SendMessages]
                },
                {
                    id: guild.client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AddReactions]
                }
            ]
        });
        logger.info(`[Bülten] ${guild.name} sunucusunda ${channel.name} kanalı otomatik oluşturuldu.`);
    }

    return channel;
}

async function generateAndPublishBulletin(guild, triggerUser = null) {
    const channel = await getOrCreateBulletinChannel(guild);

    // Sunucudaki son sohbetlerden örnek topla — SADECE @everyone'ın görebildiği herkese açık
    // kanallardan. Eskiden bot erişebildiği HER metin kanalını (mod-log, yönetici-özel gibi
    // normalde gizli kanallar dahil) tarıyordu; oradaki özel konuşmalar AI özeti üzerinden
    // herkese açık bültende ifşa olabiliyordu — bu bir bilgi sızıntısı riskiydi.
    let sampleLogs = [];
    const everyoneRole = guild.roles.everyone;
    const textChannels = guild.channels.cache.filter(c =>
        c.type === ChannelType.GuildText &&
        c.id !== channel.id &&
        c.permissionsFor(everyoneRole)?.has(PermissionFlagsBits.ViewChannel)
    );
    for (const [, ch] of textChannels) {
        try {
            const msgs = await ch.messages.fetch({ limit: 15 });
            msgs.forEach(m => {
                if (!m.author.bot && m.content && m.content.length > 3) {
                    sampleLogs.push(`${m.author.displayName}: ${m.content.slice(0, 80)}`);
                }
            });
            if (sampleLogs.length >= 30) break;
        } catch (e) {}
    }

    const todayStr = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

    const prompt = `Sen "${guild.name}" Discord sunucusunun baş editörü ve gazetecisisin.
Sunucudaki son konuşulanlardan örnekler:
${sampleLogs.slice(0, 25).join('\n')}

Sunucu için çok eğlenceli, samimi, esprili ve ilgi çekici bir "HAFTALIK TOPLULUK BÜLTENİ / GAZETESİ" hazırla.
Aşağıdaki bölümleri mutlaka içersin:
1. 📢 MANŞET HABERİ (Çok dikkat çekici bir olay veya geyik)
2. 🌟 HAFTANIN GELİŞTİRİCİSİ / YILDIZI (Örnek bir övgü)
3. 💬 SOHBETTEN DEDİKODULAR & İNCİLER (Esprili alıntılar veya şakalaşmalar)
4. 💻 TEKNOLOJİ & YAZILIM KÖŞESİ (Yazılımcılara 1 hap bilgi veya ipucu)
5. 🎯 EDİTÖRÜN HAFTALIK TAVSİYESİ & FIKRASI

Türkçe, samimi, bol emojili ve gazete mizanpajı havasında yaz.`;

    const content = await callAIProviders([
        { role: 'system', content: 'Sen mizahi, zeki ve profesyonel bir Discord gazete editörüsün.' },
        { role: 'user', content: prompt }
    ]);

    const finalContent = content || '📰 Bu haftanın bülteni baskıya yetişemedi, haftaya bomba haberlerle buradayız!';

    const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle(`📰 ${guild.name.toUpperCase()} HAFTALIK BÜLTENİ`)
        .setDescription(`**Baskı Tarihi:** ${todayStr}\n*Yapay zeka muhabirleri tarafından sunucu verileriyle hazırlandı.*\n\n` + finalContent.slice(0, 3900))
        .setFooter({ text: `Yayınlayan: ${triggerUser ? triggerUser.tag : 'Otomatik Sistem'} • ${guild.memberCount} Üye` })
        .setTimestamp();

    const msg = await channel.send({ embeds: [embed] });
    await msg.react('📰').catch(() => {});
    await msg.react('🔥').catch(() => {});
    await msg.react('👏').catch(() => {});
    await msg.react('⭐').catch(() => {});

    return { channel, message: msg };
}

module.exports = { getOrCreateBulletinChannel, generateAndPublishBulletin };
