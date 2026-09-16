const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setSettings } = require('./database');

const pendingOrganizePlans = new Map(); // guildId -> planArray

function formatChannelName(ch) {
    const raw = ch.name.toLowerCase().replace(/^[^\w\s\u00C0-\u017F]+/, '').trim();
    const type = ch.type;

    if (type === ChannelType.GuildVoice) {
        if (/muzik|music|radyo|radio/i.test(raw)) {
            return { newName: '🎵 │ Müzik Odası', isSpecial: false };
        }
        if (/olustur|oluştur|oda ac|masa ac|join to create/i.test(raw)) {
            return { newName: '➕ │ Oda Oluştur', isTempHub: true };
        }
        if (/duo|ikili/i.test(raw)) {
            return { newName: '🎮 │ Duo Odası (2P)', userLimit: 2 };
        }
        if (/squad|takim|ekip/i.test(raw)) {
            return { newName: '🎮 │ Squad Odası (5P)', userLimit: 5 };
        }
        if (/afk|uyku/i.test(raw)) {
            return { newName: '💤 │ AFK', isSpecial: false };
        }

        // Genel ses kanalı
        const cleanName = raw.charAt(0).toUpperCase() + raw.slice(1);
        return { newName: `🔊 │ ${cleanName}` };
    }

    if (type === ChannelType.GuildText || type === ChannelType.GuildAnnouncement) {
        if (/kural|rule/i.test(raw)) {
            return { newName: '📜│kurallar', readonly: true };
        }
        if (/duyuru|announc/i.test(raw)) {
            return { newName: '📢│duyurular', readonly: true };
        }
        if (/etkinlik|event|cekilis|giveaway/i.test(raw)) {
            return { newName: '🎉│etkinlik-ve-cekilis', readonly: true };
        }
        if (/giris|welcome|hosgeldin|hoşgeldin|katilan|gelen/i.test(raw)) {
            return { newName: '👋│hos-geldin', readonly: true, isWelcome: true };
        }
        if (/sohbet|chat|genel|general/i.test(raw)) {
            return { newName: '💬│genel-sohbet' };
        }
        if (/bot|komut|command/i.test(raw)) {
            return { newName: '🤖│bot-komut' };
        }
        if (/medya|media|foto|photo|resim|klip|clip|ss/i.test(raw)) {
            return { newName: '📷│medya-paylasim' };
        }
        if (/destek|ticket|yardim|help|talep/i.test(raw)) {
            return { newName: '🎫│destek-talebi', readonly: true, isTicket: true };
        }
        if (/oyuncu|lfg|takim-ara|arkadas/i.test(raw)) {
            return { newName: '🔍│oyuncu-ara-lfg' };
        }

        // Genel metin kanalı
        return { newName: `💬│${raw.replace(/\s+/g, '-')}` };
    }

    return { newName: ch.name };
}

function analyzeGuildChannels(guild) {
    const channels = guild.channels.cache.filter(c =>
        c.type === ChannelType.GuildText ||
        c.type === ChannelType.GuildVoice ||
        c.type === ChannelType.GuildAnnouncement
    );

    const plan = [];
    for (const [, ch] of channels) {
        const formatted = formatChannelName(ch);
        if (formatted.newName !== ch.name || formatted.readonly) {
            plan.push({
                channelId: ch.id,
                oldName: ch.name,
                newName: formatted.newName,
                type: ch.type,
                readonly: formatted.readonly || false,
                isWelcome: formatted.isWelcome || false,
                isTicket: formatted.isTicket || false,
                isTempHub: formatted.isTempHub || false,
                userLimit: formatted.userLimit || ch.userLimit || 0
            });
        }
    }
    return plan;
}

function getOrganizationPreviewEmbed(guild, plan) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🛠️ KANAL DÜZENLEME ÖNİZLEMESİ (${guild.name})`)
        .setDescription(
            `Sunucunuzda taranan **${plan.length} adet kanal** için estetik emoji ve tematik formatlama planı hazırlandı!\n\n` +
            `*Aşağıdaki değişiklikleri inceleyip yeşil butona basarak onaylayabilirsiniz. Onay vermediğiniz sürece hiçbir değişiklik uygulanmaz.*`
        );

    if (plan.length === 0) {
        embed.setDescription('✅ Sunucunuzdaki kanallar zaten düzgün ve tematik bir şekilde biçimlendirilmiş görünüyor!');
        return embed;
    }

    const lines = plan.slice(0, 15).map(item => {
        const typeIcon = item.type === ChannelType.GuildVoice ? '🔊' : '#';
        const extra = item.readonly ? ' *(Salt-Okunur)*' : '';
        return `${typeIcon} \`${item.oldName}\` ──▶ **\`${item.newName}\`**${extra}`;
    });

    embed.addFields({
        name: `📋 Düzenlenecek Kanallar (Toplam: ${plan.length})`,
        value: lines.join('\n') + (plan.length > 15 ? `\n*...ve ${plan.length - 15} kanal daha*` : '')
    });

    embed.setFooter({ text: 'Hiçbir mesaj veya kanal silinmeyecektir, sadece isimler ve yetkiler iyileştirilecektir.' })
        .setTimestamp();

    return embed;
}

async function executeOrganization(guild, plan, interaction) {
    let successCount = 0;
    const settingsUpdate = {};

    await interaction.editReply({
        content: `⏳ Kanallar düzenleniyor... (0 / ${plan.length})`,
        embeds: [],
        components: []
    });

    for (let i = 0; i < plan.length; i++) {
        const item = plan[i];
        const channel = guild.channels.cache.get(item.channelId);

        if (channel) {
            try {
                // İsim güncellemesi
                if (channel.name !== item.newName) {
                    await channel.setName(item.newName);
                }

                // Salt-okunur yetki güncellemesi
                if (item.readonly) {
                    await channel.permissionOverwrites.edit(guild.id, {
                        SendMessages: false
                    });
                }

                // Limit güncellemesi
                if (item.userLimit && channel.type === ChannelType.GuildVoice) {
                    await channel.setUserLimit(item.userLimit);
                }

                if (item.isWelcome) settingsUpdate.welcomeChannelId = channel.id;
                if (item.isTempHub) settingsUpdate.tempVoiceHubId = channel.id;

                successCount++;
            } catch (err) {
                console.error(`Kanal düzenlenemedi (${item.oldName}):`, err);
            }
        }

        // Kullanıcıyı her 3 kanalda bir bilgilendir
        if ((i + 1) % 3 === 0 || i === plan.length - 1) {
            await interaction.editReply({
                content: `⏳ Kanallar düzenleniyor... (${i + 1} / ${plan.length})`
            }).catch(() => {});
        }
    }

    if (Object.keys(settingsUpdate).length > 0) {
        setSettings(guild.id, settingsUpdate);
    }

    const resultEmbed = new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle('✅ Kanallar Başarıyla Düzenlendi!')
        .setDescription(`Sunucunuzdaki **${successCount} adet kanal** tematik isim formatlarına, emojilere ve güvenlik yetkilerine kavuşturuldu!`)
        .setFooter({ text: 'Discord.js v14 Kanal Düzenleyici' })
        .setTimestamp();

    await interaction.editReply({ content: null, embeds: [resultEmbed], components: [] });
}

module.exports = {
    pendingOrganizePlans,
    analyzeGuildChannels,
    getOrganizationPreviewEmbed,
    executeOrganization
};
