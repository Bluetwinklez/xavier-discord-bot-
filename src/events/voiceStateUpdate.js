const { Events, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getSettings } = require('../utils/database');
const { addTempVoice, isTempVoice, removeTempVoice } = require('../utils/tempVoiceManager');
const { handleMemberLeftVoiceChannel } = require('../utils/voiceListener');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const guild = newState.guild || oldState.guild;
        if (!guild) return;

        const settings = getSettings(guild.id);

        // 0. Sesle komut dinlenen kullanıcı, dinlemenin yapıldığı kanaldan ayrılır/kanal değiştirirse
        // dinlemeyi otomatik durdur (aksi halde bot boş kanalda "dinlemeye" devam eder).
        // try/catch: burası patlarsa aşağıdaki oda oluşturma/silme bölümleri hiç çalışmazdı.
        try {
            if (oldState.channelId && oldState.channelId !== newState.channelId) {
                handleMemberLeftVoiceChannel(guild.id, oldState.id, oldState.channelId);
            }
        } catch (error) {
            console.error('Sesle-dinle oturumu kapatılırken hata:', error);
        }

        // 1. Kullanıcı "Oda Oluştur" ana kanalına girdiğinde yeni geçici oda açma
        if (settings.tempVoiceHubId && newState.channelId === settings.tempVoiceHubId) {
            const hubChannel = newState.channel;
            const member = newState.member;

            try {
                // Kullanıcıya özel ses kanalı oluştur
                const tempChannel = await guild.channels.create({
                    name: `🔊 │ ${member.displayName}'in Odası`,
                    type: ChannelType.GuildVoice,
                    parent: hubChannel.parentId || null,
                    permissionOverwrites: [
                        {
                            id: guild.id, // @everyone: temel kullanım (konuş, gör, katıl, yazı, ekran/video paylaş)
                            allow: [
                                PermissionFlagsBits.Connect,
                                PermissionFlagsBits.Speak,
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.Stream,
                                PermissionFlagsBits.UseVAD
                            ]
                        },
                        {
                            id: member.id, // Odayı oluşturan kişi: yukarıdakilere ek olarak oda yönetimi yetkileri
                            allow: [
                                PermissionFlagsBits.ManageChannels,
                                PermissionFlagsBits.MoveMembers,
                                PermissionFlagsBits.MuteMembers,
                                PermissionFlagsBits.DeafenMembers,
                                PermissionFlagsBits.PrioritySpeaker,
                                PermissionFlagsBits.Connect,
                                PermissionFlagsBits.Speak,
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.Stream,
                                PermissionFlagsBits.ManageMessages
                            ]
                        },
                        {
                            id: newState.client.user.id, // Bot
                            allow: [
                                PermissionFlagsBits.ManageChannels,
                                PermissionFlagsBits.MoveMembers,
                                PermissionFlagsBits.Connect,
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages
                            ]
                        }
                    ]
                });

                // Geçici odayı hafızaya kaydet
                addTempVoice(tempChannel.id, member.id, guild.id);

                // Kullanıcıyı yeni oluşturulan odaya taşı
                await member.voice.setChannel(tempChannel);

                // Odanın metin sohbetine oda sahibine özel bilgilendirme kartı gönder
                const controlEmbed = new EmbedBuilder()
                    .setColor(0x00FF88)
                    .setTitle(`👑 Özel Odanıza Hoş Geldiniz, ${member.displayName}!`)
                    .setDescription(
                        `Bu oda size özel olarak oluşturuldu. **Yalnızca bu odada geçerli olan yönetici yetkileriniz bulunmaktadır!**\n\n` +
                        `**Kullanabileceğiniz Komutlar:**\n` +
                        `• \`/oda-isim <ad>\` — Odanın adını değiştirir.\n` +
                        `• \`/oda-limit <sayi>\` — Odaya giriş kişi sınırını ayarlar.\n` +
                        `• \`/oda-kilit\` — Odayı kilitler veya kilidi açar.\n` +
                        `• \`/oda-at <kullanici>\` — İstenmeyen birini odadan çıkartır.\n\n` +
                        `🎥 Bu odada video/ekran paylaşabilir ve bu metin kanalına yazabilirsiniz.\n` +
                        `*Odadaki tüm kullanıcılar ayrıldığında bu oda otomatik olarak silinecektir.*`
                    )
                    .setTimestamp();

                await tempChannel.send({ content: `${member}`, embeds: [controlEmbed] }).catch(() => {});
            } catch (error) {
                console.error('Geçici oda oluşturma hatası:', error);
            }
        }

        // 2. Bir odadan çıkıldığında ve geçici oda boşaldığında odayı silme
        if (oldState.channelId && isTempVoice(oldState.channelId)) {
            const channel = oldState.channel;
            if (channel && channel.members.size === 0) {
                try {
                    removeTempVoice(oldState.channelId);
                    await channel.delete('Geçici oda boşaldığı için otomatik silindi.');
                } catch (error) {
                    console.error('Boşalan geçici oda silinirken hata:', error);
                }
            }
        }
    },
};
