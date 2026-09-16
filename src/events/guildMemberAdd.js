const { trackMemberJoin } = require('../utils/inviteTracker');
const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getSettings } = require('../utils/database');
const { sendServerLog } = require('../utils/serverLog');
const { checkJoin } = require('../utils/antiRaidManager');
const { checkAndNotify: checkBadges } = require('../utils/badgeManager');
const logger = require('../utils/logger');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        // Bir bot OAuth2 ile sunucuya eklendiğinde de bu event tetiklenir (eklenen bot da bir
        // guild member'dır). Bu kontrol olmadan, sunucuya eklenen HER bot da oto-rol/kayıt rolünü
        // otomatik alıyordu — o rol kanallara yazma gibi izinler taşıyorsa güvenlik açığı olurdu.
        if (member.user.bot) return;

        const guild = member.guild;
        const settings = getSettings(guild.id);

        // 1. Anti-Raid Güvenlik Kalkanı Kontrolü
        const raidStatus = checkJoin(member);
        const { inviterUser, inviterStats } = await trackMemberJoin(member);

        // Davet sayısı 3'e ulaşınca "Topluluk Elçisi" rozeti açılıyor — davet edenin GuildMember'ını
        // burada çekip kontrol ediyoruz (inviterUser sadece bir User, joinedTimestamp'i yok).
        if (inviterUser && !inviterUser.bot) {
            guild.members.fetch(inviterUser.id).then(inviterMember => checkBadges(guild, inviterMember)).catch(() => {});
        }

        if (raidStatus.isLockdown) {
            // ESKİDEN bu sadece konsola log yazıyordu — hiçbir gerçek engelleme yapılmıyordu.
            // Hem otomatik raid tespiti hem de manuel `/guvenlik-kilidi durum: ac` kilidi, üyeye
            // "karantinaya alınır" / "engellenir" diye vaat ediyordu ama üye normal şekilde içeri
            // giriyor, oto-rolünü alıyor, mesaj atabiliyordu — koruma tamamen kozmetikti.
            // Kick (ban değil) tercih edildi: geri dönüşü var, kilit kalkınca kullanıcı normal
            // şekilde tekrar katılabilir; yanlış pozitif durumunda kalıcı zarar vermez.
            logger.warn(`[Anti-Raid] ${member.user.tag} lockdown sırasında katıldı, engellendi.`);
            try {
                await member.send(
                    `🛡️ **${guild.name}** şu anda olası bir raid saldırısına karşı güvenlik kilidi altında, bu yüzden sunucuya alınamadın.\n` +
                    `Kilit kalktıktan sonra tekrar katılmayı deneyebilirsin.`
                ).catch(() => {});
                if (member.kickable) {
                    await member.kick('Anti-Raid: güvenlik kilidi aktifken katıldı');
                }
            } catch (err) {
                logger.error(`[Anti-Raid] ${member.user.tag} engellenirken hata:`, err);
            }

            sendServerLog(guild, {
                title: '🚨 Anti-Raid: Üye Engellendi',
                color: 0xED4245,
                description: `Güvenlik kilidi aktifken katılan **${member.user.tag}** otomatik olarak sunucudan çıkarıldı.`,
                fields: [{ name: '👤 Kullanıcı', value: `\`${member.id}\``, inline: true }]
            }).catch(() => {});

            return;
        }

        // 2. Denetim / Olay Logu
        sendServerLog(guild, {
            title: '📥 Üye Katıldı',
            color: 0x2ECC71,
            fields: [
                { name: '👤 Kullanıcı', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
                { name: '🕒 Hesap Yaşı', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '👥 Üye Sayısı', value: `${guild.memberCount}`, inline: true }
            ]
        }).catch(() => {});

        // Resimli Karşılama Kartı URL'si (Popcat Canvas Engine)
        const welcomeCardUrl = `https://api.popcat.xyz/welcomecard?background=https://images.unsplash.com/photo-1550745165-9bc0b252726f&text1=${encodeURIComponent(member.user.username)}&text2=${encodeURIComponent(`Sunucumuzun ${guild.memberCount}. Üyesi!`)}&text3=${encodeURIComponent(guild.name)}&avatar=${encodeURIComponent(member.user.displayAvatarURL({ extension: 'png' }))}`;

        // 3. KAYIT SİSTEMİ AKTİFSE:
        if (settings.registrationEnabled && settings.unregisteredRoleId) {
            try {
                const role = guild.roles.cache.get(settings.unregisteredRoleId);
                if (role) await member.roles.add(role);
            } catch (err) {
                logger.error(`[Kayıt Sistemi] ${member.user.tag} kullanıcısına kayıtsız rolü verilemedi:`, err);
            }

            if (settings.welcomeChannelId) {
                const channel = guild.channels.cache.get(settings.welcomeChannelId);
                if (channel) {
                    const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
                    const trust = accountAgeDays >= 7 ? '✅ Güvenilir' : '⚠️ Yeni Hesap (Dikkat)';

                    const embed = new EmbedBuilder()
                        .setColor(0x5865F2)
                        .setTitle('👋 Sunucumuza Hoş Geldin!')
                        .setDescription(`${member}, aramıza katıldığın için mutluyuz!\nSeninle birlikte **${guild.memberCount}** kişi olduk.\n\nDevam edebilmek için aşağıdaki **Kayıt Ol** butonuna tıkla.`)
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                        .setImage(welcomeCardUrl)
                        .addFields(
                            { name: '🆔 Kullanıcı ID', value: `\`${member.id}\``, inline: true },
                            { name: '🕒 Hesap Kuruluş', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                            { name: '🛡️ Güvenilirlik', value: trust, inline: true }
                        )
                        .setFooter({ text: `${guild.name} Kayıt Sistemi` })
                        .setTimestamp();

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('register_member').setLabel('Kayıt Ol').setEmoji('📝').setStyle(ButtonStyle.Success)
                    );

                    channel.send({ content: `${member}`, embeds: [embed], components: [row] }).catch(() => {});
                }
            }
            return;
        }

        // 4. KAYIT SİSTEMİ KAPALIYSA: Oto-rol + Resimli Hoş Geldin Kartı
        if (settings.autoRoleId) {
            try {
                const role = guild.roles.cache.get(settings.autoRoleId);
                if (role) {
                    await member.roles.add(role);
                    logger.info(`[Oto-Rol] ${member.user.tag} kullanıcısına ${role.name} rolü verildi.`);
                }
            } catch (err) {
                logger.error(`[Oto-Rol Hata] ${member.user.tag} kullanıcısına rol verilemedi:`, err);
            }
        }

        if (settings.welcomeChannelId) {
            try {
                const channel = guild.channels.cache.get(settings.welcomeChannelId);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor(0x00FF88)
                        .setTitle('🎉 Sunucumuza Hoş Geldin!')
                        .setDescription(`Aramıza katıldığın için mutluyuz, ${member}!\nSeninle birlikte **${guild.memberCount}** kişi olduk!`)
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                        .setImage(welcomeCardUrl)
                        .addFields(
                            { name: '🕒 Hesap Kuruluş', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                            { name: '🆔 Üye ID', value: `\`${member.id}\`` , inline: true }
                        )
                        .setFooter({ text: `${guild.name} Topluluğu`, iconURL: guild.iconURL({ dynamic: true }) })
                        .setTimestamp();

                    await channel.send({ content: `👋 Hoş geldin ${member}!`, embeds: [embed] });
                }
            } catch (err) {
                logger.error(`[Hoş Geldin Hata] Karşılama mesajı gönderilemedi:`, err);
            }
        }
    },
};
