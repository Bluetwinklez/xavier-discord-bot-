const { PermissionFlagsBits, ChannelType, EmbedBuilder, ActivityType } = require('discord.js');
const { getRulesEmbeds } = require('./rulesTemplate');
const { getTempVoice, isTempVoice } = require('./tempVoiceManager');
const { analyzeGuildChannels } = require('./channelOrganizer');
const { THEMES, customThemes, applyThemeToGuild } = require('./themeCatalog');
const { getQueue, queues, playQuery, skipSong, setVolume, toggleLoop, shuffleQueue, setEffect, voteSkip } = require('./musicManager');
const { fetchLyrics } = require('./lyricsFetcher');
const { getSettings, setSettings } = require('./database');
const { addCustomCommand, addKnowledge, removeSkill, getGuildSkills } = require('./customSkillManager');
const { playRadio, playTTS, set247Voice, cleanupVoice } = require('./radioCatalog');
const { getPersona, getAllPersonas } = require('./aiPersonas');
const { getAutomodSettings, setAutomodSettings } = require('./automod');
const { createBackup } = require('./backupManager');
const { getRank } = require('./levelSystem');
const { addWarn, getWarns, clearWarns, AUTO_TIMEOUT_THRESHOLD, AUTO_TIMEOUT_MINUTES } = require('./warnManager');
const { setupStatsChannels, removeStatsChannels } = require('./statsChannels');
const { addModAction, getModHistory } = require('./moderationHistory');
const { setBirthday } = require('./birthdayManager');
const { setupStarboard } = require('./starboard');
const { getBalance, claimDaily } = require('./economyManager');
const { parseDuration, addReminder } = require('./reminderManager');
const { setAfk } = require('./afkManager');
const { startListening, stopListening } = require('./voiceListener');

const CAPABILITIES_SUMMARY = `🤖 **Yapabildiklerim:**

🎨 **Tema & Kurulum:** Hazır sunucu temaları kurma, AI ile özel tema tasarlama, kanalları düzenleme (kurulum öncesi otomatik yedek alınır)
🛡️ **Moderasyon:** Ban/kick/timeout, toplu mesaj silme, otomatik moderasyon (yasaklı kelime, davet linki, spam engelleme), anti-raid güvenlik kilidi
📁 **Kanal & Rol:** Tekli/toplu kanal-kategori-rol oluşturma/silme
📋 **Log Sistemi:** Ban/kick/mesaj silme/kanal-rol değişikliklerini bir kanala otomatik kaydetme
📝 **Kayıt Sistemi:** Butonlu üye kayıt/doğrulama akışı
🎮 **Seviye & Etkileşim:** XP/seviye sistemi, liderlik tablosu, çekiliş, self-rol menüsü, anket, rozetler
💰 **Ekonomi & Mağaza:** Bakiye, günlük ödül, çalışma, para transferi, zenginlik sıralaması, isim rengi mağazası (\`/market\`), blackjack/slot/çarkıfelek
⏰ **Hatırlatıcı & AFK:** Zamanlanmış hatırlatma kurma/listeleme/iptal etme, AFK moduna geçme
🎵 **Müzik & Ses:** Şarkı çalma (ayrı müzik botu üzerinden, kontrol butonlu panel), radyo, TTS seslendirme, sesle-komut dinleme (gerçek zamanlı, araya girebilirsin)
💻 **Kod Çalıştırma:** \`/kod-calistir\` ile Python/JS/C++/Java/Go/Rust/PHP/C#/TS kodunu gerçek bir sandbox'ta çalıştırma, \`/hata-coz\` ile hata analizi
🧠 **AI Özelleştirme:** Kişilik/mod değiştirme, özel komut/bilgi öğretme, AI Yönetici rolü ile yetki devri, resim çizme (\`/ai-ciz\`), özet/çeviri/mülakat/analiz araçları (\`/ai-araclar\`)
🌐 **Ek Araçlar:** Hava durumu, döviz kuru, sözlük, GitHub repo bilgisi, snippet kaydetme, pomodoro, şaka, tavsiye
👋 **Karşılama:** Yeni üyelere hoş geldin mesajı/kartı, doğum günü kutlaması, geçici sesli oda sistemi
💾 **Yedekleme:** Sunucu rol/kanal yapısını (izinleriyle birlikte) yedekleme ve geri yükleme
🎫 **Destek:** Yetkili rol destekli butonlu ticket sistemi

Detaylı komut listesi için \`/yardim\` yazabilirsin. Yönetimle ilgili şeyleri sadece AI Yönetici rolü olanlar yaptırabilir, herkes benimle sohbet edebilir ve müzik/eğlence gibi normal üye işlerini yaptırabilir.`;

// Geri alınamaz eylemler (tüm kanal/rol silme gibi) eskiden AI Yönetici rolüne sahip biri
// isteyince HİÇBİR onay olmadan direkt uygulanıyordu. executeAction düz bir string döndürdüğü
// için (messageCreate.js/ai.js/voiceListener.js tarafından doğrudan mesaj içeriği olarak
// gönderiliyor) buton eklemek üç farklı çağıran yeri de değiştirmeyi gerektirirdi — bunun yerine
// "aynı isteği bir kez daha yaz" deseniyle onaylatıyoruz: üye+eylem bazlı bekleyen onay kaydı.
const DESTRUCTIVE_ACTIONS = new Set([
    'delete_all_channels', 'clear_channels', 'bulk_delete_channels',
    'bulk_delete_roles', 'delete_roles_matching', 'delete_roles', 'clear_roles', 'delete_all_roles'
]);
const pendingDestructiveConfirmations = new Map(); // "guildId:memberId:action" -> timestamp
const CONFIRMATION_WINDOW_MS = 90 * 1000;

const destructiveCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of pendingDestructiveConfirmations) {
        if (now - ts > CONFIRMATION_WINDOW_MS) pendingDestructiveConfirmations.delete(key);
    }
}, 5 * 60 * 1000);
if (destructiveCleanupTimer.unref) destructiveCleanupTimer.unref();

// Kullanıcıyı etiket, id veya isimden bulma yardımcısı
function findTargetMember(guild, query) {
    if (!query) return null;
    const clean = query.replace(/[<@!>]/g, '').trim().toLowerCase();
    return guild.members.cache.find(m =>
        m.id === clean ||
        m.user.username.toLowerCase() === clean ||
        m.displayName.toLowerCase().includes(clean)
    );
}

// Kanalı isim veya etiket ile bulma yardımcısı
function findTargetChannel(guild, query, fallbackChannel) {
    if (!query) return fallbackChannel;
    const clean = query.replace(/[<#>]/g, '').trim().toLowerCase();
    return guild.channels.cache.find(c =>
        c.id === clean ||
        c.name.toLowerCase().includes(clean)
    ) || fallbackChannel;
}

async function executeAction(actionName, params = {}, context) {
    const { guild, channel, member, client } = context;
    if (!guild || !member) {
        return '❌ Bu eylem yalnızca sunucu içerisinde çalıştırılabilir.';
    }

    // AI Yönetici Rolü: /ai-panel üzerinden atanan bu role sahip kişiler, o eylem için gereken
    // gerçek Discord yetkisine bizzat sahip olmasalar bile AI üzerinden yönetim eylemleri yürütebilir.
    // Rol atanmamışsa (aiManagerRoleId yok) davranış eskisiyle birebir aynıdır: sadece gerçek yetkisi
    // olanlar (veya sunucu Yöneticileri) ilgili eylemi yaptırabilir.
    const guildSettings = getSettings(guild.id);
    const isAiManager = !!(guildSettings.aiManagerRoleId && member.roles.cache.has(guildSettings.aiManagerRoleId));
    const hasPerm = (perm) => member.permissions.has(perm) || isAiManager;

    if (DESTRUCTIVE_ACTIONS.has(actionName)) {
        const confirmKey = `${guild.id}:${member.id}:${actionName}`;
        const pendingAt = pendingDestructiveConfirmations.get(confirmKey);
        if (pendingAt && Date.now() - pendingAt < CONFIRMATION_WINDOW_MS) {
            pendingDestructiveConfirmations.delete(confirmKey);
            // Onaylandı — aşağıdaki switch'e devam edip gerçek eylemi çalıştır.
        } else {
            pendingDestructiveConfirmations.set(confirmKey, Date.now());
            return `⚠️ **Bu işlem GERİ ALINAMAZ** ve çok sayıda kanal/rol etkileyebilir. Emin misen? Onaylamak için isteğini ${Math.floor(CONFIRMATION_WINDOW_MS / 1000)} saniye içinde AYNEN bir kez daha yaz.`;
        }
    }

    switch (actionName) {
        // ==========================================
        // 1. TEMA VE SUNUCU KURULUMU
        // ==========================================
        case 'apply_theme': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) {
                return '❌ Sunucu temasını değiştirmek için `Yönetici` yetkisine sahip olmalısınız.';
            }

            const themeKey = (params.theme_id || params.theme || 'gaming').toLowerCase();
            const wipe = params.wipe === true || params.wipe === 'true';

            let theme = THEMES[themeKey];
            if (!theme) {
                const matchedKey = Object.keys(THEMES).find(k => themeKey.includes(k) || THEMES[k].name.toLowerCase().includes(themeKey));
                if (matchedKey) theme = THEMES[matchedKey];
            }

            if (!theme) {
                return `❌ Tema bulunamadı. Mevcut temalar: \`${Object.keys(THEMES).join(', ')}\``;
            }

            const statusMsg = await channel.send(`⏳ **${theme.name}** teması kuruluyor...`);
            const mockInteraction = {
                channelId: channel.id,
                channel: channel,
                editReply: async (data) => {
                    if (typeof data === 'string') return statusMsg.edit({ content: data, embeds: [], components: [] }).catch(() => {});
                    return statusMsg.edit(data).catch(() => {});
                }
            };

            try {
                await applyThemeToGuild(guild, theme, mockInteraction, wipe);
                return `🎉 **${theme.name}** teması başarıyla kuruldu! ${wipe ? '(Eski kanallar temizlendi)' : '(Mevcut kanallara eklendi)'}`;
            } catch (err) {
                return `❌ Tema kurulum hatası: ${err.message}`;
            }
        }

        // ==========================================
        // 2. ÜYE MODERASYONU (BAN, KICK, TIMEOUT, ROL)
        // ==========================================
        case 'ban_member': {
            if (!hasPerm(PermissionFlagsBits.BanMembers)) {
                return '❌ Üye yasaklamak için `Üyeleri Yasakla` yetkiniz bulunmuyor.';
            }
            const target = findTargetMember(guild, params.user || params.target);
            if (!target) return '❌ Yasaklanacak kullanıcı sunucuda bulunamadı.';
            if (!target.bannable) return '❌ Bu kullanıcıyı yasaklamaya yetkim yetmiyor (benden üst bir role sahip).';

            const reason = `${params.reason || 'AI talimatı ile yasaklandı'} (İsteyen: ${member.user.tag})`;
            try {
                await target.ban({ reason });
                addModAction(guild.id, target.id, 'ban', member.id, reason);
                return `🔨 **${target.user.tag}** sunucudan yasaklandı! (Sebep: ${reason})`;
            } catch (err) {
                return `❌ Yasaklama başarısız: ${err.message}`;
            }
        }

        case 'kick_member': {
            if (!hasPerm(PermissionFlagsBits.KickMembers)) {
                return '❌ Üye atmak için `Üyeleri At` yetkiniz bulunmuyor.';
            }
            const target = findTargetMember(guild, params.user || params.target);
            if (!target) return '❌ Atılacak kullanıcı sunucuda bulunamadı.';
            if (!target.kickable) return '❌ Bu kullanıcıyı atmaya yetkim yetmiyor.';

            const reason = params.reason || 'AI talimatı ile atıldı.';
            try {
                await target.kick(reason);
                addModAction(guild.id, target.id, 'kick', member.id, reason);
                return `👢 **${target.user.tag}** sunucudan atıldı! (Sebep: ${reason})`;
            } catch (err) {
                return `❌ Atma işlemi başarısız: ${err.message}`;
            }
        }

        case 'timeout_member': {
            if (!hasPerm(PermissionFlagsBits.ModerateMembers)) {
                return '❌ Susturma vermek için `Üyeleri Zamanaşımına Uğrat` yetkiniz bulunmuyor.';
            }
            const target = findTargetMember(guild, params.user || params.target);
            if (!target) return '❌ Kullanıcı bulunamadı.';
            const minutes = Math.min(Math.max(parseInt(params.minutes) || 5, 1), 40320); // max 28 gün
            try {
                const reason = params.reason || 'AI talimatı ile susturuldu';
                await target.timeout(minutes * 60 * 1000, reason);
                addModAction(guild.id, target.id, 'timeout', member.id, `${reason} (${minutes} dk)`);
                return `🔇 **${target.user.tag}** kullanıcısına **${minutes} dakika** susturma verildi.`;
            } catch (err) {
                return `❌ Susturma başarısız: ${err.message}`;
            }
        }

        case 'remove_timeout': {
            if (!hasPerm(PermissionFlagsBits.ModerateMembers)) {
                return '❌ Susturmayı kaldırmak için yetkiniz bulunmuyor.';
            }
            const target = findTargetMember(guild, params.user || params.target);
            if (!target) return '❌ Kullanıcı bulunamadı.';
            try {
                await target.timeout(null);
                return `🔊 **${target.user.tag}** kullanıcısının susturması kaldırıldı!`;
            } catch (err) {
                return `❌ İşlem başarısız: ${err.message}`;
            }
        }

        case 'add_role_to_user': {
            if (!hasPerm(PermissionFlagsBits.ManageRoles)) {
                return '❌ Rol vermek için `Rolleri Yönet` yetkiniz bulunmuyor.';
            }
            const target = findTargetMember(guild, params.user || params.target);
            if (!target) return '❌ Kullanıcı bulunamadı.';
            const roleName = (params.role || '').toLowerCase();
            const role = guild.roles.cache.find(r => r.name.toLowerCase().includes(roleName));
            if (!role) return `❌ "${params.role}" adında bir rol bulunamadı.`;
            try {
                await target.roles.add(role);
                return `✅ **${target.user.tag}** kullanıcısına **${role.name}** rolü verildi!`;
            } catch (err) {
                return `❌ Rol verilemedi: ${err.message}`;
            }
        }

        case 'remove_role_from_user': {
            if (!hasPerm(PermissionFlagsBits.ManageRoles)) {
                return '❌ Rol almak için `Rolleri Yönet` yetkiniz bulunmuyor.';
            }
            const target = findTargetMember(guild, params.user || params.target);
            if (!target) return '❌ Kullanıcı bulunamadı.';
            const roleName = (params.role || '').toLowerCase();
            const role = guild.roles.cache.find(r => r.name.toLowerCase().includes(roleName));
            if (!role) return `❌ "${params.role}" adında bir rol bulunamadı.`;
            try {
                await target.roles.remove(role);
                return `🗑️ **${target.user.tag}** kullanıcısından **${role.name}** rolü alındı.`;
            } catch (err) {
                return `❌ Rol alınamadı: ${err.message}`;
            }
        }

        case 'change_nickname': {
            if (!hasPerm(PermissionFlagsBits.ManageNicknames)) {
                return '❌ Takma ad değiştirmek için yetkiniz bulunmuyor.';
            }
            const target = findTargetMember(guild, params.user || params.target);
            if (!target) return '❌ Kullanıcı bulunamadı.';
            const nick = params.nickname || params.name || '';
            try {
                await target.setNickname(nick);
                return `✏️ **${target.user.tag}** takma adı **${nick || '(Sıfırlandı)'}** olarak ayarlandı.`;
            } catch (err) {
                return `❌ İsim değiştirilemedi: ${err.message}`;
            }
        }

        // ==========================================
        // 3. DUYURU VE ANKET SİSTEMİ
        // ==========================================
        case 'send_announcement': {
            if (!hasPerm(PermissionFlagsBits.ManageMessages)) {
                return '❌ Duyuru yapmak için `Mesajları Yönet` yetkiniz bulunmuyor.';
            }
            const targetChannel = findTargetChannel(guild, params.channel_name, channel);
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`📢 ${params.title || 'SUNUCU DUYURUSU'}`)
                .setDescription(params.message || params.content || 'Duyuru metni belirtilmedi.')
                .setFooter({ text: `Duyuran: ${member.displayName}` })
                .setTimestamp();

            await targetChannel.send({ embeds: [embed] });
            return `📢 Duyuru **${targetChannel}** kanalında yayınlandı!`;
        }

        case 'create_poll': {
            const targetChannel = findTargetChannel(guild, params.channel_name, channel);
            const question = params.question || 'Anket';
            let options = params.options || ['Evet', 'Hayır'];
            if (typeof options === 'string') options = options.split(/[,|\n]/).map(o => o.trim());

            const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
            const lines = options.slice(0, 10).map((opt, i) => `${numberEmojis[i]} ${opt}`);

            const pollEmbed = new EmbedBuilder()
                .setColor(0x00FF88)
                .setTitle(`📊 ANKET: ${question}`)
                .setDescription(lines.join('\n\n'))
                .setFooter({ text: `Anketi Başlatan: ${member.displayName} | Tepki vererek oy kullanın!` })
                .setTimestamp();

            const pollMsg = await targetChannel.send({ embeds: [pollEmbed] });
            for (let i = 0; i < Math.min(options.length, 10); i++) {
                await pollMsg.react(numberEmojis[i]).catch(() => {});
            }
            return `📊 Anket **${targetChannel}** kanalında başlatıldı!`;
        }

        // ==========================================
        // 4. KANAL VE KATEGORİ YÖNETİMİ
        // ==========================================
        case 'create_category': {
            if (!hasPerm(PermissionFlagsBits.ManageChannels)) {
                return '❌ Kategori oluşturmak için yetkiniz bulunmuyor.';
            }
            const cat = await guild.channels.create({
                name: `📁 │ ${(params.name || 'YENİ KATEGORİ').toUpperCase()}`,
                type: ChannelType.GuildCategory
            });
            return `📁 **${cat.name}** kategorisi başarıyla açıldı!`;
        }

        case 'bulk_create_channels': {
            if (!hasPerm(PermissionFlagsBits.ManageChannels)) {
                return '❌ Kanal oluşturmak için yetkiniz bulunmuyor.';
            }
            const channelList = params.channels || [];
            let createdCount = 0;
            for (const chInfo of channelList.slice(0, 20)) {
                const isVoice = chInfo.type === 'voice' || chInfo.type === 'ses' || chInfo.type === 2;
                const cleanName = (chInfo.name || 'kanal').toLowerCase().replace(/\s+/g, '-');
                const displayName = isVoice ? `🔊 │ ${chInfo.name}` : `💬│${cleanName}`;
                
                let parentCategory = null;
                if (chInfo.category) {
                    parentCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes(chInfo.category.toLowerCase()));
                    if (!parentCategory) {
                        try {
                            parentCategory = await guild.channels.create({
                                name: `📁 │ ${chInfo.category.toUpperCase()}`,
                                type: ChannelType.GuildCategory
                            });
                        } catch {}
                    }
                }

                try {
                    await guild.channels.create({
                        name: displayName,
                        type: isVoice ? ChannelType.GuildVoice : ChannelType.GuildText,
                        parent: parentCategory ? parentCategory.id : undefined
                    });
                    createdCount++;
                } catch (e) {}
            }
            return `✨ Toplam **${createdCount} adet kanal** topluca açıldı ve yerleştirildi!`;
        }

        case 'bulk_create_categories': {
            if (!hasPerm(PermissionFlagsBits.ManageChannels)) {
                return '❌ Kategori oluşturmak için yetkiniz bulunmuyor.';
            }
            const catList = params.categories || [];
            let count = 0;
            for (const catInfo of catList.slice(0, 10)) {
                try {
                    const catName = typeof catInfo === 'string' ? catInfo : catInfo.name;
                    const newCat = await guild.channels.create({
                        name: `📁 │ ${catName.toUpperCase()}`,
                        type: ChannelType.GuildCategory
                    });
                    count++;

                    if (typeof catInfo === 'object' && Array.isArray(catInfo.channels)) {
                        for (const ch of catInfo.channels.slice(0, 8)) {
                            const isVoice = ch.type === 'voice' || ch.type === 'ses';
                            const cleanName = (ch.name || 'kanal').toLowerCase().replace(/\s+/g, '-');
                            await guild.channels.create({
                                name: isVoice ? `🔊 │ ${ch.name}` : `💬│${cleanName}`,
                                type: isVoice ? ChannelType.GuildVoice : ChannelType.GuildText,
                                parent: newCat.id
                            });
                        }
                    }
                } catch {}
            }
            return `📁 Toplam **${count} adet kategori ve alt kanalları** başarıyla kuruldu!`;
        }

        case 'bulk_delete_channels': {
            if (!hasPerm(PermissionFlagsBits.ManageChannels)) {
                return '❌ Kanalları silmek için yetkiniz bulunmuyor.';
            }
            const keyword = (params.keyword || '').toLowerCase();
            const names = params.names || params.channel_names || [];
            const protectedAiChannelId = getSettings(guild.id).aiChannelId;
            let deletedCount = 0;
            const toDelete = guild.channels.cache.filter(c => {
                if (c.id === channel.id) return false;
                if (c.id === protectedAiChannelId) return false; // AI kanalı bot tarafından asla silinmez
                if (keyword === 'tüm' || keyword === 'tum') return true;
                if (keyword && c.name.toLowerCase().includes(keyword)) return true;
                if (names.some(n => c.name.toLowerCase().includes(n.toLowerCase()))) return true;
                return false;
            });
            for (const c of toDelete.values()) {
                try {
                    await c.delete('AI Toplu Kanal Silme');
                    deletedCount++;
                } catch {}
            }
            return `🗑️ Toplam **${deletedCount} adet kanal** topluca silindi.`;
        }

        case 'create_channel': {
            if (!hasPerm(PermissionFlagsBits.ManageChannels)) {
                return '❌ Kanal oluşturmak için yetkiniz bulunmuyor.';
            }
            const rawName = (params.name || 'yeni-kanal').toLowerCase().replace(/\s+/g, '-');
            const isVoice = params.type === 'voice' || params.type === 'ses';
            const newCh = await guild.channels.create({
                name: isVoice ? `🔊 │ ${params.name}` : `💬│${rawName}`,
                type: isVoice ? ChannelType.GuildVoice : ChannelType.GuildText
            });
            return `✅ **${newCh}** kanalı açıldı!`;
        }

        case 'delete_channel': {
            if (!hasPerm(PermissionFlagsBits.ManageChannels)) {
                return '❌ Kanal silmek için yetkiniz bulunmuyor.';
            }
            const targetName = (params.channel_name || params.name || '').toLowerCase();
            const target = guild.channels.cache.find(c => c.name.toLowerCase().includes(targetName) && c.id !== channel.id);
            if (!target) return `❌ "${targetName}" adında kanal bulunamadı.`;
            const name = target.name;
            await target.delete();
            return `🗑️ **#${name}** kanalı silindi.`;
        }

        case 'set_channel_topic': {
            if (!hasPerm(PermissionFlagsBits.ManageChannels)) {
                return '❌ Kanal konusunu değiştirmek için yetkiniz bulunmuyor.';
            }
            await channel.setTopic(params.topic || '');
            return `📌 Kanal konusu ayarlandı: *"${params.topic}"*`;
        }

        case 'hide_channel': {
            if (!hasPerm(PermissionFlagsBits.ManageChannels)) {
                return '❌ Kanalı gizlemek için yetkiniz bulunmuyor.';
            }
            await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false });
            return '👁️‍🗨️ Bu kanal üyelere **gizlendi** (Sadece yetkililer görebilir).';
        }

        case 'unhide_channel': {
            if (!hasPerm(PermissionFlagsBits.ManageChannels)) {
                return '❌ Kanalı görünür yapmak için yetkiniz bulunmuyor.';
            }
            await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: null });
            return '👀 Bu kanal tekrar **herkese görünür** yapıldı.';
        }

        case 'lock_channel': {
            if (!hasPerm(PermissionFlagsBits.ManageChannels)) {
                return '❌ Kanal kilitlemek için yetkiniz bulunmuyor.';
            }
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
            return '🔒 Bu kanal yazı yazmaya **kilitlendi!**';
        }

        case 'unlock_channel': {
            if (!hasPerm(PermissionFlagsBits.ManageChannels)) {
                return '❌ Kanal kilidini açmak için yetkiniz bulunmuyor.';
            }
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
            return '🔓 Kanal kilidi açıldı!';
        }

        case 'set_slowmode': {
            if (!hasPerm(PermissionFlagsBits.ManageChannels)) {
                return '❌ Yavaş mod ayarlamak için yetkiniz bulunmuyor.';
            }
            const seconds = Math.min(Math.max(parseInt(params.seconds) || 0, 0), 21600);
            await channel.setRateLimitPerUser(seconds);
            return seconds === 0 ? '⚡ Yavaş mod kaldırıldı.' : `⏱️ Kanala **${seconds} sn** yavaş mod uygulandı.`;
        }

        // ==========================================
        // 5. SUNUCU & BOT YÖNETİMİ & EĞLENCE
        // ==========================================
        case 'set_server_name': {
            if (!hasPerm(PermissionFlagsBits.ManageGuild)) {
                return '❌ Sunucu adını değiştirmek için `Sunucuyu Yönet` yetkiniz bulunmuyor.';
            }
            await guild.setName(params.name || 'Sunucu');
            return `🏰 Sunucu adı **${params.name}** olarak değiştirildi!`;
        }

        case 'set_bot_activity': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) {
                return '❌ Bot durumunu değiştirmek için `Yönetici` olmalısınız.';
            }
            const actName = params.activity || 'Discord';
            client.user.setActivity(actName, { type: ActivityType.Playing });
            return `🎮 Bot durumu **"${actName} Oynuyor"** olarak ayarlandı!`;
        }

        case 'random_user': {
            const members = guild.members.cache.filter(m => !m.user.bot);
            const luckyOne = members.random();
            return `🎉 **Çekiliş Kazananı / Seçilen Kişi:** ${luckyOne} (\`${luckyOne.user.tag}\`)! Tebrikler!`;
        }

        case 'flip_coin': {
            const result = Math.random() < 0.5 ? '🪙 **Yazı** geldi!' : '🪙 **Tura** geldi!';
            return result;
        }

        case 'roll_dice': {
            const sides = parseInt(params.sides) || 6;
            const roll = Math.floor(Math.random() * sides) + 1;
            return `🎲 Zar atıldı (1-${sides}): **${roll}**!`;
        }

        // ==========================================
        // 6. DİĞER FONKSİYONLAR (MESAJ SİLME, SES, MÜZİK)
        // ==========================================
        case 'purge_messages': {
            if (!hasPerm(PermissionFlagsBits.ManageMessages)) {
                return '❌ Mesajları silmek için yetkiniz bulunmuyor.';
            }
            const count = Math.min(Math.max(parseInt(params.count) || 5, 1), 100);
            const deleted = await channel.bulkDelete(count, true);
            return `🧹 **${deleted.size} adet mesaj** temizlendi!`;
        }

        case 'create_role': {
            if (!hasPerm(PermissionFlagsBits.ManageRoles)) {
                return '❌ Rol oluşturmak için yetkiniz bulunmuyor.';
            }
            const newRole = await guild.roles.create({
                name: params.name || 'Yeni Rol',
                color: params.color || 0x5865F2,
                hoist: params.hoist ?? true
            });
            return `🎭 **${newRole.name}** rolü oluşturuldu!`;
        }

        case 'bulk_create_roles': {
            if (!hasPerm(PermissionFlagsBits.ManageRoles)) {
                return '❌ Rol oluşturmak için `Rolleri Yönet` yetkiniz bulunmuyor.';
            }
            const roleList = params.roles || [];
            let createdCount = 0;
            const names = [];
            for (const rInfo of roleList.slice(0, 20)) {
                try {
                    const rName = typeof rInfo === 'string' ? rInfo : (rInfo.name || 'Yeni Rol');
                    const color = typeof rInfo === 'object' && rInfo.color ? rInfo.color : null;
                    const hoist = typeof rInfo === 'object' && rInfo.hoist !== undefined ? rInfo.hoist : true;
                    await guild.roles.create({
                        name: rName,
                        color: color || undefined,
                        hoist: hoist,
                        reason: 'AI Toplu Rol Kurulumu'
                    });
                    createdCount++;
                    names.push(rName);
                } catch (e) {}
            }
            return `🛡️ Toplam **${createdCount} adet rol** başarıyla oluşturuldu:\n> ${names.join(', ')}`;
        }

        case 'bulk_delete_roles': {
            if (!hasPerm(PermissionFlagsBits.ManageRoles)) {
                return '❌ Rolleri silmek için `Rolleri Yönet` yetkiniz bulunmuyor.';
            }
            const keyword = (params.keyword || '').toLowerCase();
            const names = params.names || params.role_names || [];
            let deletedCount = 0;
            const toDelete = guild.roles.cache.filter(r => {
                if (r.managed || r.isEveryone()) return false;
                if (r.position >= guild.members.me.roles.highest.position) return false;
                if (keyword === 'tüm' || keyword === 'tum') return true;
                if (keyword && r.name.toLowerCase().includes(keyword)) return true;
                if (names.some(n => r.name.toLowerCase().includes(n.toLowerCase()))) return true;
                return false;
            });
            for (const r of toDelete.values()) {
                try {
                    await r.delete('AI Toplu Rol Silme');
                    deletedCount++;
                } catch (e) {}
            }
            return `🗑️ Toplam **${deletedCount} adet rol** başarıyla silindi.`;
        }

        case 'multi_action': {
            const actionList = params.actions || [];
            const results = [];
            for (const act of actionList) {
                if (act && act.action) {
                    const res = await executeAction(act.action, act.params || {}, context);
                    if (res) results.push(res);
                }
            }
            return results.join('\n') || '⚡ Toplu eylemler başarıyla tamamlandı.';
        }

        case 'delete_role': {
            if (!hasPerm(PermissionFlagsBits.ManageRoles)) {
                return '❌ Rol silmek için `Rolleri Yönet` yetkiniz bulunmuyor.';
            }
            const rName = (params.role_name || params.name || params.role || '').toLowerCase();
            if (!rName) return '❌ Silinecek rolün adı belirtilmedi.';
            const role = guild.roles.cache.find(r => r.name.toLowerCase().includes(rName) && r.id !== guild.id && !r.managed);
            if (!role) return `❌ "${rName}" adında silinebilir bir rol bulunamadı.`;

            const myHighest = guild.members.me.roles.highest.position;
            if (role.position >= myHighest) {
                return `❌ **${role.name}** rolü botun rolünden daha yüksek seviyede olduğu için silinemiyor. (Discord Kuralı: Botun rolünü Sunucu Ayarları > Roller sekmesinden daha yukarı taşıyınız).`;
            }
            await role.delete();
            return `🗑️ **${role.name}** rolü başarıyla silindi!`;
        }

        case 'delete_roles_matching':
        case 'delete_roles':
        case 'clear_roles':
        case 'delete_all_roles': {
            if (!hasPerm(PermissionFlagsBits.ManageRoles) && !hasPerm(PermissionFlagsBits.Administrator)) {
                return '❌ Rolleri silmek için `Rolleri Yönet` veya `Yönetici` yetkiniz bulunmuyor.';
            }

            const keyword = (params.keyword || params.category || params.pattern || params.name || '').toLowerCase().trim();
            const myHighest = guild.members.me.roles.highest.position;

            const ZODIAC = ['koç', 'koc', 'boğa', 'boga', 'ikizler', 'yengeç', 'yengec', 'aslan', 'başak', 'basak', 'terazi', 'akrep', 'yay', 'oğlak', 'oglak', 'kova', 'balık', 'balik', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];

            // Önce kriterlere uyan tüm rolleri bul
            const allMatching = guild.roles.cache.filter(r => {
                if (r.id === guild.id || r.managed) return false;
                const rLower = r.name.toLowerCase();
                if (keyword === 'burç' || keyword === 'burc' || keyword.includes('burç') || keyword.includes('burc')) {
                    return rLower.includes('burç') || rLower.includes('burc') || ZODIAC.some(z => rLower.includes(z));
                }
                if (keyword && keyword !== 'tüm' && keyword !== 'hepsi' && keyword !== 'bütün') {
                    return rLower.includes(keyword);
                }
                return true;
            });

            if (allMatching.size === 0) {
                return keyword ? `ℹ️ Sunucuda "${keyword}" ile eşleşen bir rol bulunamadı.` : 'ℹ️ Sunucuda silinebilecek özel rol bulunamadı.';
            }

            // Hiyerarşi kontrolü: Eğer hepsi botun yetkisinin üzerindeyse
            const unremovable = allMatching.filter(r => r.position >= myHighest);
            const rolesToDelete = allMatching.filter(r => r.position < myHighest);

            if (rolesToDelete.size === 0) {
                const sample = unremovable.map(r => r.name).slice(0, 4).join(', ');
                return `⚠️ **${unremovable.size} adet rol bulundu** (${sample}...), ancak Discord güvenlik kuralları gereği botun (**${guild.members.me.displayName}**) rolü bu rollerden aşağıda olduğu için silinemiyor! Lütfen **Sunucu Ayarları > Roller** sekmesinden botun rolünü yukarı taşıyınız.`;
            }

            let count = 0;
            const deletedNames = [];
            for (const [id, role] of rolesToDelete) {
                try {
                    await role.delete();
                    deletedNames.push(role.name);
                    count++;
                } catch (err) {
                    console.error(`Rol silinemedi (${role.name}):`, err.message);
                }
            }

            const sample = deletedNames.slice(0, 5).join(', ');
            const extra = deletedNames.length > 5 ? ` ve ${deletedNames.length - 5} rol daha` : '';
            return `🗑️ Toplam **${count} adet rol** başarıyla silindi! (${sample}${extra})`;
        }

        case 'clear_channels':
        case 'delete_all_channels': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) {
                return '❌ Tüm kanalları silmek için `Yönetici` yetkiniz bulunmuyor.';
            }
            const protectedAiChannelId2 = getSettings(guild.id).aiChannelId;
            let count = 0;
            for (const [id, ch] of guild.channels.cache) {
                if (ch.id === channel.id) continue;
                if (ch.id === protectedAiChannelId2) continue; // AI kanalı bot tarafından asla silinmez
                try {
                    await ch.delete();
                    count++;
                } catch (err) {}
            }
            return `🗑️ Toplam **${count} adet kanal** silindi! (AI kanalı korundu)`;
        }

        case 'send_rules': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) return '❌ Yetkiniz yetersiz.';
            const { embeds, files } = getRulesEmbeds();
            await channel.send({ embeds, files });
            return '📜 Kurallar panosu asıldı!';
        }

        case 'organize_channels': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) return '❌ Yetkiniz yetersiz.';
            const plan = analyzeGuildChannels(guild);
            for (const item of plan) {
                const ch = guild.channels.cache.get(item.channelId);
                if (ch && ch.name !== item.newName) await ch.setName(item.newName).catch(() => {});
            }
            return `✨ **${plan.length} adet kanal** tematik emojilerle düzenlendi!`;
        }

        case 'lock_room': {
            const voiceChannel = member.voice?.channel;
            if (!voiceChannel || !isTempVoice(voiceChannel.id)) return '❌ Geçici ses odasında değilsiniz.';
            await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
            return '🔒 Odanız kilitlendi!';
        }

        case 'unlock_room': {
            const voiceChannel = member.voice?.channel;
            if (!voiceChannel || !isTempVoice(voiceChannel.id)) return '❌ Geçici ses odasında değilsiniz.';
            await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: true });
            return '🔓 Odanızın kilidi açıldı!';
        }

        case 'rename_room': {
            const voiceChannel = member.voice?.channel;
            if (!voiceChannel || !isTempVoice(voiceChannel.id)) return '❌ Geçici ses odasında değilsiniz.';
            await voiceChannel.setName(`🔊 │ ${params.name || 'Özel Oda'}`);
            return `✏️ Odanızın adı değiştirildi!`;
        }

        case 'set_room_limit': {
            const voiceChannel = member.voice?.channel;
            if (!voiceChannel || !isTempVoice(voiceChannel.id)) return '❌ Geçici ses odasında değilsiniz.';
            const limit = Math.min(Math.max(parseInt(params.limit) || 0, 0), 99);
            await voiceChannel.setUserLimit(limit);
            return `👥 Oda sınırı **${limit} kişi** yapıldı.`;
        }

        case 'play_music': {
            let voiceChannel = member.voice?.channel;
            if (!voiceChannel && params.channel_name) {
                voiceChannel = findTargetChannel(guild, params.channel_name, null);
            }
            if (!voiceChannel || (voiceChannel.type !== ChannelType.GuildVoice && voiceChannel.type !== ChannelType.GuildStageVoice)) {
                return '❌ Müzik çalabilmem için önce bir ses kanalına katılmalısınız veya kanal adı belirtmelisiniz.';
            }
            const songName = params.query || params.sarki || params.song || params.name;
            if (!songName) return '❌ Çalınacak şarkı veya müzik adı belirtilmedi.';
            const result = await playQuery(guild, voiceChannel, channel, songName, member.displayName);
            return result;
        }

        case 'pause_music': {
            const queue = getQueue(guild.id);
            if (!queue || !queue.player) return '❌ Şu anda çalan bir müzik yok.';
            queue.player.pause();
            return '⏸️ Müzik duraklatıldı.';
        }

        case 'resume_music': {
            const queue = getQueue(guild.id);
            if (!queue || !queue.player) return '❌ Şu anda duraklatılmış bir müzik yok.';
            queue.player.unpause();
            return '▶️ Müzik devam ettiriliyor.';
        }

        case 'show_queue': {
            const queue = getQueue(guild.id);
            if (!queue || !queue.songs || queue.songs.length === 0) return '📝 Müzik kuyruğu şu anda boş.';
            const list = queue.songs.slice(0, 5).map((s, i) => `${i === 0 ? '▶️ Çalan:' : `${i}.`} **${s.title}** (${s.duration})`).join('\n');
            return `🎶 **Müzik Kuyruğu:**\n${list}`;
        }

        case 'skip_music': {
            const skipped = skipSong(guild.id);
            if (!skipped) return '❌ Çalan şarkı yok.';
            return `⏭️ **${skipped.title}** atlandı, sıradaki şarkıya geçildi!`;
        }

        case 'set_music_volume': {
            const level = setVolume(guild.id, parseInt(params.level ?? params.volume ?? params.percent) || 100);
            if (level === null) return '❌ Şu anda çalan bir müzik yok.';
            return `🔊 Müzik ses seviyesi **%${level}** olarak ayarlandı.`;
        }

        case 'toggle_music_loop': {
            const loop = toggleLoop(guild.id);
            if (loop === null) return '❌ Şu anda çalan bir müzik yok.';
            return loop ? '🔁 Şarkı tekrar modu **açıldı**.' : '➡️ Şarkı tekrar modu **kapatıldı**.';
        }

        case 'shuffle_music_queue': {
            const count = shuffleQueue(guild.id);
            if (!count) return '❌ Karıştırılacak yeterli şarkı yok (en az 3 şarkı gerekir).';
            return `🔀 Kuyruktaki **${count} şarkı** karıştırıldı.`;
        }

        case 'stop_music': {
            const queue = getQueue(guild.id);
            if (!queue) return '❌ Bot seste değil.';
            if (queue.connection) {
                try { queue.connection.destroy(); } catch {}
            }
            queues.delete(guild.id);
            return '⏹️ Müzik durduruldu ve sesten çıkıldı.';
        }

        case 'show_lyrics': {
            const queue = getQueue(guild.id);
            if (!queue || !queue.songs || queue.songs.length === 0) return '❌ Şu anda çalan bir şarkı yok.';
            const song = queue.songs[0];
            const result = await fetchLyrics(song.title);
            if (!result) return `❌ **${song.title}** için söz bulunamadı.`;
            const truncated = result.lyrics.length > 1500;
            const lyricsText = truncated ? result.lyrics.slice(0, 1500) + '\n*(...sözler uzun olduğu için kırpıldı, tam hali için /muzik sozler)*' : result.lyrics;
            return `📜 **${result.artist} - ${result.title}**\n\n${lyricsText}`;
        }

        case 'set_music_effect': {
            const queue = getQueue(guild.id);
            if (!queue || !queue.songs || queue.songs.length === 0) return '❌ Şu anda çalan bir şarkı yok.';
            const raw = (params.effect || params.tur || 'none').toLowerCase();
            const effect = ['bassboost', 'bass'].includes(raw) ? 'bassboost' : (raw === 'nightcore' ? 'nightcore' : 'none');
            setEffect(guild.id, effect);
            const labels = { none: 'Normal (efektsiz)', bassboost: 'Bass Boost', nightcore: 'Nightcore' };
            return `🎛️ Efekt **${labels[effect]}** olarak ayarlandı, şarkı baştan başlatılıyor.`;
        }

        case 'vote_skip_music': {
            const voiceChannel = member.voice?.channel;
            if (!voiceChannel) return '❌ Oy kullanmak için bir ses kanalında olmalısınız.';
            const result = voteSkip(guild.id, member.id, voiceChannel);
            if (result.reason === 'no_song') return '❌ Kuyrukta atlanacak şarkı yok.';
            if (result.ok) return `⏭️ Oylama tamamlandı (${result.votesSoFar}/${result.votersNeeded}), şarkı atlandı!`;
            return `🗳️ Oy kaydedildi (${result.votesSoFar}/${result.votersNeeded}). Daha fazla oy gerekiyor.`;
        }

        case 'setup_log_channel':
        case 'set_log_channel': {
            if (!hasPerm(PermissionFlagsBits.ManageGuild) && !hasPerm(PermissionFlagsBits.ManageChannels)) {
                return '❌ Log kanalını ayarlamak için `Sunucuyu Yönet` veya `Kanalları Yönet` yetkisine sahip olmalısınız.';
            }

            const guildSettings2 = getSettings(guild.id);
            let targetChannel = null;

            if (params.channel_name) {
                targetChannel = findTargetChannel(guild, params.channel_name, null);
            }

            if (!targetChannel && guildSettings2.logChannelId) {
                targetChannel = guild.channels.cache.get(guildSettings2.logChannelId);
            }

            if (!targetChannel) {
                targetChannel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.toLowerCase().includes('log'));
            }

            if (!targetChannel) {
                targetChannel = await guild.channels.create({
                    name: '📋┃log-kayitlari',
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] }
                    ]
                });
            }

            setSettings(guild.id, { logChannelId: targetChannel.id });

            const infoEmbed = new EmbedBuilder()
                .setColor(0x00FF88)
                .setTitle('📋 Denetim Kaydı & Log Akışı Başlatıldı')
                .setDescription('Bu kanal, sunucu yöneticileri için otomatik denetim kaydı ve olay akış kanalı olarak ayarlandı.')
                .addFields(
                    { name: '🔒 Güvenlik', value: 'Bu kanal sadece yöneticilerin erişimine açıktır.', inline: true },
                    { name: '📜 Kapsam', value: 'Ban, unban, kick, timeout, rol güncellemeleri, kanal/kategori işlemleri ve ses odası taşımaları anlık kaydedilir.', inline: true }
                )
                .setTimestamp();

            targetChannel.send({ embeds: [infoEmbed] }).catch(() => {});

            return `📋 Log kanalı hem oluşturuldu hem de Denetim Kaydı akışı **${targetChannel}** kanalına bağlandı!`;
        }

        case 'toggle_automod': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) return '❌ Otomatik moderasyonu değiştirmek için Yönetici yetkisi gereklidir.';
            const enabled = params.enabled === true || params.enabled === 'true' || params.enabled === undefined;
            setAutomodSettings(guild.id, { enabled });
            return enabled ? '🛡️ Otomatik moderasyon **açıldı**.' : '⏸️ Otomatik moderasyon **kapatıldı**.';
        }

        case 'automod_add_word': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) return '❌ Yasaklı kelime eklemek için Yönetici yetkisi gereklidir.';
            const word = (params.word || params.kelime || '').toLowerCase().trim();
            if (!word) return '❌ Eklenecek kelime belirtilmedi.';
            const current = getAutomodSettings(guild.id);
            const words = new Set(current.bannedWords || []);
            words.add(word);
            setAutomodSettings(guild.id, { bannedWords: [...words] });
            return `✅ **"${word}"** yasaklı kelime listesine eklendi.`;
        }

        case 'automod_remove_word': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) return '❌ Yasaklı kelime silmek için Yönetici yetkisi gereklidir.';
            const word = (params.word || params.kelime || '').toLowerCase().trim();
            const current = getAutomodSettings(guild.id);
            const words = (current.bannedWords || []).filter(w => w !== word);
            setAutomodSettings(guild.id, { bannedWords: words });
            return `🗑️ **"${word}"** yasaklı kelime listesinden çıkarıldı.`;
        }

        case 'automod_list_words': {
            const current = getAutomodSettings(guild.id);
            const words = current.bannedWords || [];
            return words.length ? `🚫 Yasaklı kelimeler: ${words.map(w => `\`${w}\``).join(', ')}` : '📝 Yasaklı kelime listesi boş.';
        }

        case 'automod_block_invites': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) return '❌ Bu ayarı değiştirmek için Yönetici yetkisi gereklidir.';
            const block = params.block !== false && params.block !== 'false';
            setAutomodSettings(guild.id, { blockInvites: block });
            return block ? '🔗 Discord davet linki paylaşımı **engellendi**.' : '🔗 Discord davet linki paylaşımı **serbest bırakıldı**.';
        }

        case 'automod_set_spam_threshold': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) return '❌ Bu ayarı değiştirmek için Yönetici yetkisi gereklidir.';
            const count = Math.min(Math.max(parseInt(params.count) || 5, 2), 30);
            const seconds = Math.min(Math.max(parseInt(params.seconds) || 5, 2), 60);
            setAutomodSettings(guild.id, { spamCount: count, spamSeconds: seconds });
            return `⏱️ Spam eşiği **${seconds} saniyede ${count} mesaj** olarak ayarlandı.`;
        }

        case 'setup_registration': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) return '❌ Kayıt sistemi kurmak için Yönetici yetkisi gereklidir.';

            let welcomeChannel = params.channel_name ? findTargetChannel(guild, params.channel_name, null) : null;
            if (!welcomeChannel) {
                welcomeChannel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.toLowerCase().includes('hos-geldin'));
            }
            if (!welcomeChannel) {
                welcomeChannel = await guild.channels.create({
                    name: '👋│hos-geldin',
                    type: ChannelType.GuildText,
                    permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.SendMessages] }]
                });
            }

            const unregRole = guild.roles.cache.find(r => r.name === '🔒 Kayıtsız')
                || await guild.roles.create({ name: '🔒 Kayıtsız', color: 0x99AAB5, reason: 'AI ile kayıt sistemi kurulumu' });

            const regRole = guild.roles.cache.find(r => r.name === '✅ Kayıtlı Üye')
                || await guild.roles.create({ name: '✅ Kayıtlı Üye', color: 0x2ECC71, hoist: true, reason: 'AI ile kayıt sistemi kurulumu' });

            setSettings(guild.id, {
                welcomeChannelId: welcomeChannel.id,
                registrationEnabled: true,
                unregisteredRoleId: unregRole.id,
                registeredRoleId: regRole.id
            });

            return `📝 Kayıt sistemi kuruldu! Yeni üyeler ${welcomeChannel} kanalındaki "Kayıt Ol" butonuyla ${unregRole} rolünden ${regRole} rolüne geçecek.`;
        }

        case 'warn_member': {
            if (!hasPerm(PermissionFlagsBits.ModerateMembers)) return '❌ Uyarı vermek için `Üyeleri Zamanaşımına Uğrat` yetkiniz bulunmuyor.';
            const target = findTargetMember(guild, params.user || params.target);
            if (!target) return '❌ Uyarılacak kullanıcı bulunamadı.';
            const reason = params.reason || 'Belirtilmedi';
            const { count, shouldAutoTimeout } = addWarn(guild.id, target.id, member.id, reason);
            target.user.send(`⚠️ **${guild.name}** sunucusunda uyarıldın.\n**Sebep:** ${reason}\n**Toplam uyarın:** ${count}`).catch(() => {});
            let extra = '';
            if (shouldAutoTimeout && target.moderatable) {
                try {
                    await target.timeout(AUTO_TIMEOUT_MINUTES * 60 * 1000, `Otomatik: ${AUTO_TIMEOUT_THRESHOLD} uyarıya ulaştı`);
                    extra = ` ⚠️ ${AUTO_TIMEOUT_THRESHOLD} uyarıya ulaştığı için ${AUTO_TIMEOUT_MINUTES} dakika otomatik susturuldu.`;
                } catch {}
            }
            return `⚠️ **${target.user.tag}** uyarıldı! (Toplam: ${count})${extra}`;
        }

        case 'list_warnings': {
            const target = findTargetMember(guild, params.user || params.target) || member;
            if (target.id !== member.id && !hasPerm(PermissionFlagsBits.ModerateMembers)) {
                return '❌ Başka bir kullanıcının uyarılarını görmek için `Üyeleri Zamanaşımına Uğrat` yetkiniz bulunmuyor.';
            }
            const warns = getWarns(guild.id, target.id);
            if (warns.length === 0) return `✅ **${target.displayName}** kullanıcısının hiç uyarısı yok.`;
            const lines = warns.map(w => `#${w.id}: ${w.reason}`).join('\n');
            return `⚠️ **${target.displayName}** — ${warns.length} uyarı:\n${lines}`;
        }

        case 'clear_warnings': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) return '❌ Uyarıları temizlemek için Yönetici yetkisi gereklidir.';
            const target = findTargetMember(guild, params.user || params.target);
            if (!target) return '❌ Kullanıcı bulunamadı.';
            const count = clearWarns(guild.id, target.id);
            return count > 0 ? `✅ **${target.user.tag}** kullanıcısının ${count} uyarısı temizlendi.` : `ℹ️ Zaten hiç uyarısı yoktu.`;
        }

        case 'get_moderation_history': {
            if (!hasPerm(PermissionFlagsBits.ModerateMembers)) return '❌ Moderasyon geçmişini görmek için `Üyeleri Zamanaşımına Uğrat` yetkiniz bulunmuyor.';
            const target = findTargetMember(guild, params.user || params.target);
            if (!target) return '❌ Kullanıcı bulunamadı.';
            const history = getModHistory(guild.id, target.id);
            if (history.length === 0) return `✅ **${target.displayName}** kullanıcısının moderasyon geçmişi yok.`;
            const lines = history.slice(-10).map(a => `${a.type}: ${a.reason}`).join('\n');
            return `📋 **${target.displayName}** — ${history.length} kayıt:\n${lines}`;
        }

        case 'setup_starboard': {
            if (!hasPerm(PermissionFlagsBits.ManageGuild)) return '❌ Starboard kurmak için `Sunucuyu Yönet` yetkiniz bulunmuyor.';
            let starChannel = params.channel_name ? findTargetChannel(guild, params.channel_name, null) : null;
            if (!starChannel) {
                starChannel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.toLowerCase().includes('starboard'))
                    || await guild.channels.create({ name: '⭐│starboard', type: ChannelType.GuildText });
            }
            const threshold = parseInt(params.threshold) || 3;
            setupStarboard(guild.id, starChannel.id, threshold, params.emoji || '⭐');
            return `⭐ Starboard kuruldu! ${starChannel} kanalında **${threshold}** tepki alan mesajlar öne çıkarılacak.`;
        }

        case 'set_birthday': {
            const monthNum = parseInt(params.month);
            const dayNum = parseInt(params.day);
            if (!monthNum || !dayNum) return '❌ Ay ve gün belirtilmedi.';
            setBirthday(guild.id, member.id, monthNum, dayNum);
            return `🎂 Doğum gününüz **${dayNum}/${monthNum}** olarak kaydedildi!`;
        }

        case 'get_balance': {
            const targetMember = params.user ? findTargetMember(guild, params.user) : member;
            if (!targetMember) return '❌ Kullanıcı bulunamadı.';
            const balance = getBalance(guild.id, targetMember.id);
            return `💰 **${targetMember.displayName}** bakiyesi: **${balance}** 🪙`;
        }

        case 'claim_daily': {
            const result = claimDaily(guild.id, member.id);
            if (!result.ok) {
                const hours = Math.floor(result.remainingMs / (60 * 60 * 1000));
                const minutes = Math.floor((result.remainingMs % (60 * 60 * 1000)) / (60 * 1000));
                return `⏳ Günlük ödülünü zaten aldın! Tekrar almak için ${hours} saat ${minutes} dakika bekle.`;
            }
            return `🎁 Günlük ödülün: **+${result.amount}** 🪙\n💰 Yeni bakiyen: **${result.balance}** 🪙`;
        }

        case 'set_reminder': {
            const durationStr = params.duration || params.sure || params.time;
            const reminderMsg = params.message || params.mesaj || params.text;
            if (!durationStr || !reminderMsg) return '❌ Hatırlatma süresi veya mesajı belirtilmedi.';
            const ms = parseDuration(durationStr);
            if (!ms) return '❌ Süreyi anlayamadım. Örnekler: "10dk", "2saat", "1gun".';
            const triggerAt = Date.now() + ms;
            addReminder(guild.id, channel.id, member.id, reminderMsg, triggerAt);
            return `⏰ Tamamdır! <t:${Math.floor(triggerAt / 1000)}:R> hatırlatacağım: **${reminderMsg}**`;
        }

        case 'set_afk': {
            const reason = params.reason || params.sebep || 'Belirtilmedi';
            setAfk(guild.id, member.id, reason);
            return `💤 Artık AFK olarak işaretlendin: **${reason}**`;
        }

        case 'setup_server_stats': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) return '❌ İstatistik kanalları kurmak için Yönetici yetkisi gereklidir.';
            const stats = getSettings(guild.id).statsChannels;
            if (stats) {
                const hasAny = [stats.categoryId, stats.memberChannelId, stats.botChannelId, stats.boostChannelId].some(id => id && guild.channels.cache.has(id));
                if (hasAny) return 'ℹ️ İstatistik kanalları zaten kurulu.';
                setSettings(guild.id, { statsChannels: null });
            }
            await setupStatsChannels(guild);
            return '📊 İstatistik kanalları oluşturuldu! Sayılar her 10 dakikada bir otomatik güncellenir.';
        }

        case 'remove_server_stats': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) return '❌ Yetkiniz yetersiz.';
            const removed = await removeStatsChannels(guild);
            return removed ? '🗑️ İstatistik kanalları kaldırıldı.' : 'ℹ️ Kurulu istatistik kanalı yok.';
        }

        case 'get_invite_link': {
            const clientId = process.env.CLIENT_ID || client.user.id;
            const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;
            return `🔗 Beni başka bir sunucuya eklemek için bu linki kullanabilirsin:\n${inviteUrl}`;
        }

        case 'show_capabilities': {
            return CAPABILITIES_SUMMARY;
        }

        case 'create_backup': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) return '❌ Yedek almak için Yönetici yetkisi gereklidir.';
            const backup = createBackup(guild);
            const channelCount = backup.categories.reduce((sum, c) => sum + c.channels.length, 0) + backup.orphanChannels.length;
            return `💾 Sunucu yedeği alındı! (ID: \`${backup.id}\`, ${backup.roles.length} rol, ${channelCount} kanal). Geri yüklemek için \`/yedek-geri-yukle yedek-id:${backup.id}\` kullanabilirsiniz.`;
        }

        case 'check_level': {
            const targetMember = params.user ? findTargetMember(guild, params.user) : member;
            if (!targetMember) return '❌ Kullanıcı bulunamadı.';
            const rank = getRank(guild.id, targetMember.id);
            return `📊 **${targetMember.displayName}** — Seviye ${rank.level} (${rank.xp}/${rank.xpNeeded} XP), sıralama: #${rank.rank}/${rank.totalRanked}`;
        }

        case 'set_ai_role': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) return '❌ Yetkiniz yetersiz.';
            const rName = (params.role_name || params.role || '').toLowerCase();
            if (!rName || rName === 'sıfırla' || rName === 'kaldır') {
                setSettings(guild.id, { aiRoleId: null });
                return '🔒 AI özel rolü sıfırlandı. Sadece Yöneticiler kullanabilir.';
            }
            const role = guild.roles.cache.find(r => r.name.toLowerCase().includes(rName));
            if (!role) return `❌ "${rName}" adında bir rol bulunamadı.`;
            setSettings(guild.id, { aiRoleId: role.id });
            return `🤖 Yapay zekayı kullanma izni **${role.name}** rolüne verildi!`;
        }

        case 'set_ai_persona': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) return '❌ Modu değiştirmek için Yönetici yetkisi gereklidir.';
            const target = getPersona(params.persona || params.mod || 'gemini');
            setSettings(guild.id, { aiPersona: target.id });
            return `🤖 Yapay zeka modu **${target.icon} ${target.name}** (\`${target.tag}\`) olarak ayarlandı!`;
        }

        case 'list_ai_personas': {
            const list = getAllPersonas().map(p => `• **${p.icon} ${p.name}** (\`${p.id}\`): ${p.description}`).join('\n');
            return `🎭 **Mevcut Yapay Zeka Modları:**\n${list}\n\n*Değiştirmek için: \`/ai-modu mod:<seçenek>\` veya "@xavier <mod> moduna geç" yazabilirsiniz.*`;
        }

        // ==========================================
        // 7. YENİ ÖZELLİK VE YETENEK ÖĞRENME
        // ==========================================
        case 'add_custom_command': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) return '❌ Yeni özellik eklemek için Yönetici olmalısınız.';
            const trigger = params.trigger || params.command || params.kelime;
            const response = params.response || params.cevap;
            if (!trigger || !response) return '❌ Tetikleyici kelime ve cevap belirtilmelidir.';
            addCustomCommand(guild.id, trigger, response);
            return `✨ Yeni özellik eklendi: Biri **"${trigger}"** yazdığında otomatik yanıt verilecek!`;
        }

        case 'learn_knowledge': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) return '❌ Bilgi öğretmek için Yönetici olmalısınız.';
            const topic = params.topic || params.konu || 'Genel Kural';
            const content = params.content || params.bilgi || params.kural;
            if (!content) return '❌ Öğrenilecek bilgi içeriği belirtilmedi.';
            addKnowledge(guild.id, topic, content);
            return `🧠 Yeni bilgi hafızama kaydedildi: **${topic}**`;
        }

        case 'list_custom_skills': {
            const skills = getGuildSkills(guild.id);
            const cmdCount = skills.commands?.length || 0;
            const knwCount = skills.knowledge?.length || 0;
            if (cmdCount === 0 && knwCount === 0) return '📝 Henüz bana öğretilmiş özel bir komut veya bilgi bulunmuyor.';

            const cmdList = (skills.commands || []).map(c => `• **${c.trigger}** ➔ "${c.response}"`).join('\n');
            const knwList = (skills.knowledge || []).map(k => `• **${k.topic}:** ${k.content}`).join('\n');

            return `📚 **Öğrendiğim Özel Yetenekler:**\n${cmdList ? `**Özel Komutlar:**\n${cmdList}\n\n` : ''}${knwList ? `**Öğrenilen Bilgiler:**\n${knwList}` : ''}`;
        }

        case 'remove_custom_skill': {
            if (!hasPerm(PermissionFlagsBits.Administrator)) return '❌ Yetkiniz yetersiz.';
            const keyword = params.name || params.keyword || params.kelime;
            if (!keyword) return '❌ Silinecek özellik adı belirtilmedi.';
            const success = removeSkill(guild.id, keyword);
            return success ? `🗑️ **"${keyword}"** özelliği hafızamdan silindi.` : `❌ "${keyword}" adında bir özellik bulunamadı.`;
        }

        // ==========================================
        // 8. SES BOTU VE CANLI RADYO
        // ==========================================
        case 'play_radio': {
            const voiceChannel = member.voice?.channel;
            if (!voiceChannel) return '❌ Radyo açmak için bir ses kanalında olmalısınız.';
            const stationKey = (params.station || params.radyo || 'powerturk').toLowerCase();
            const station = await playRadio(voiceChannel, stationKey);
            return `📻 **${station.name}** canlı yayını ${voiceChannel.name} kanalında başlatıldı!`;
        }

        case 'join_voice':
        case 'stay_in_voice': {
            let voiceChannel = member.voice?.channel;
            if (params.channel_name) {
                voiceChannel = findTargetChannel(guild, params.channel_name, voiceChannel);
            }
            if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
                return '❌ Lütfen bir ses kanalına katılın veya kanal adı belirtin.';
            }
            await set247Voice(voiceChannel);
            return `🎙️ Bot **${voiceChannel.name}** kanalına 7/24 kalıcı olarak bağlandı!`;
        }

        case 'leave_voice': {
            stopListening(guild.id, member?.id);
            cleanupVoice(guild.id);
            try {
                guild.members.me?.voice?.disconnect();
            } catch {}
            return '👋 Bot ses kanalından ayrıldı ve 7/24 modu kapatıldı.';
        }

        case 'play_tts': {
            const voiceChannel = member.voice?.channel;
            if (!voiceChannel) return '❌ Seslendirme için bir ses kanalında olmalısınız.';
            const text = params.text || params.mesaj || 'Merhaba';
            await playTTS(voiceChannel, text);
            return `🗣️ Seste okundu: *"${text}"*`;
        }

        case 'join_and_listen': {
            const voiceChannel = member.voice?.channel;
            if (!voiceChannel) return '❌ Sesle konuşmak için önce bir ses kanalına katılmalısınız.';
            return await startListening(voiceChannel, channel, member, guild, client);
        }

        case 'stop_listening': {
            const stopped = stopListening(guild.id, member.id);
            return stopped ? '🔇 Sesle komut dinlemeyi bıraktım.' : 'ℹ️ Senin için zaten sesle komut dinlemiyordum.';
        }

        case 'summarize_chat': {
            const count = Math.min(Math.max(parseInt(params.count) || 25, 5), 50);
            const messages = await channel.messages.fetch({ limit: count }).catch(() => null);
            if (!messages || messages.size < 3) {
                return '⚠️ Özetlenecek yeterli mesaj bulunamadı.';
            }

            const chatLogs = [];
            messages.reverse().forEach(m => {
                if (!m.author.bot && m.content && m.content.trim().length > 0) {
                    chatLogs.push(`${m.author.displayName}: ${m.content.slice(0, 150)}`);
                }
            });

            if (chatLogs.length < 2) {
                return 'ℹ️ Kanalda özetlenecek kullanıcı mesajı bulunamadı.';
            }

            const prompt = `Aşağıdaki Discord sohbet mesajlarını oku. Konuşulan ana konuları ve varılan sonuçları 3-4 maddede Türkçe olarak özetle:\n\n${chatLogs.join('\n')}`;
            const { callAIProviders } = require('./aiManager');
            const summary = await callAIProviders([
                { role: 'system', content: 'Sen bir sohbet özetleyicisin. Türkçe, madde imleriyle temiz bir özet sun.' },
                { role: 'user', content: prompt }
            ]);

            return summary ? `📋 **Kanal Sohbet Özeti (Son ${chatLogs.length} mesaj):**\n\n${summary}` : '❌ Özet oluşturulamadı.';
        }

        case 'roast_user': {
            const target = params.user || params.target || member.displayName;
            const prompt = `${target} adlı kullanıcı için Discord topluluğuna uygun, esprili, zekice, tatlı-sert bir roast (taşlama) hazırla. Çok kaba olma ama güldür. Maksimum 2 cümle.`;
            const { callAIProviders } = require('./aiManager');
            const roast = await callAIProviders([
                { role: 'system', content: 'Sen hazırcevap, esprili bir Discord komedyenisin.' },
                { role: 'user', content: prompt }
            ]);
            return roast ? `🔥 **${target} için Roast:**\n${roast}` : `🔥 ${target}, sana laf yetiştirmeye bile değmez!`;
        }

        case 'praise_user': {
            const target = params.user || params.target || member.displayName;
            const prompt = `${target} adlı kullanıcı için samimi, motive edici, moral veren güzel bir iltifat yaz. 1-2 cümle.`;
            const { callAIProviders } = require('./aiManager');
            const praise = await callAIProviders([
                { role: 'system', content: 'Sen insanlara moral veren samimi bir asistansın.' },
                { role: 'user', content: prompt }
            ]);
            return praise ? `⭐ **${target} için İltifat:**\n${praise}` : `⭐ ${target}, bu sunucunun en harika üyelerindensin!`;
        }

        case 'trivia_quiz': {
            const topic = params.topic || 'yazılım, oyun veya genel kültür';
            const prompt = `Bize ${topic} hakkında 4 şıklı (A, B, C, D) eğlenceli bir soru hazırla. En altta gizli ipucu veya doğru cevabı parantez içinde belirt.`;
            const { callAIProviders } = require('./aiManager');
            const quiz = await callAIProviders([
                { role: 'system', content: 'Sen bir bilgi yarışması sunucususun.' },
                { role: 'user', content: prompt }
            ]);
            return quiz ? `🎲 **Bilgi Yarışması:**\n\n${quiz}` : '🎲 Soru hazırlanırken bir sorun oluştu.';
        }

        case 'server_mood': {
            const messages = await channel.messages.fetch({ limit: 25 }).catch(() => null);
            const chatLogs = [];
            if (messages) {
                messages.forEach(m => {
                    if (!m.author.bot && m.content) chatLogs.push(m.content.slice(0, 100));
                });
            }
            const prompt = `Aşağıdaki son sohbet mesajlarına bakarak sunucunun anlık enerjisini, modunu ve havasını (örn: %60 Eğlenceli, %30 Üretken, %10 Sakin) esprili ve samimi 2 cümleyle değerlendir:\n\n${chatLogs.join('\n')}`;
            const { callAIProviders } = require('./aiManager');
            const mood = await callAIProviders([
                { role: 'system', content: 'Sen bir atmosfer ve ruh hali analistisin.' },
                { role: 'user', content: prompt }
            ]);
            return mood ? `🌡️ **Sunucunun Anlık Havası:**\n${mood}` : '🌡️ Sunucu şu an gayet sakin ve huzurlu görünüyor.';
        }

        case 'translate_text': {
            const targetLang = params.target_language || params.language || 'İngilizce';
            const textToTranslate = params.text || '';
            if (!textToTranslate) return '⚠️ Çevrilecek bir metin belirtmelisin.';

            const prompt = `Şu metni ${targetLang} diline çevir. Sadece ve sadece çevrilmiş sonucu yaz:\n\n"${textToTranslate}"`;
            const { callAIProviders } = require('./aiManager');
            const translation = await callAIProviders([
                { role: 'system', content: 'Sen profesyonel bir dil çevirmenisin.' },
                { role: 'user', content: prompt }
            ]);
            return translation ? `🌐 **[${targetLang} Çeviri]:**\n${translation}` : '❌ Çeviri yapılamadı.';
        }

                case 'code_review': {
            const code = params.code || params.snippet || '';
            if (!code) return '⚠️ İncelemem için bir kod bloğu paylaşmalısın (örn: ```js ... ```).';

            const prompt = `Aşağıdaki kodu dikkatle incele. Varsa syntax hatalarını, mantık hatalarını, güvenlik açıklarını ve performans önerilerini açıkla. Düzeltilmiş temiz kod versiyonunu markdown kod bloğu olarak ver:\n\n${code}`;
            const { callAIProviders } = require('./aiManager');
            const review = await callAIProviders([
                { role: 'system', content: 'Sen kıdemli bir yazılım mimarısın. Türkçe, net, maddeler halinde hata analizi ve düzeltilmiş kod sun.' },
                { role: 'user', content: prompt }
            ]);
            return review ? `💻 **AI Kod İnceleme & Analizi:**\n\n${review}` : '❌ Kod analizi yapılamadı.';
        }

        case 'daily_horoscope': {
            const sign = params.sign || params.zodiac || 'Genel';
            const prompt = `${sign} burcu için bugüne özel eğlenceli, samimi, biraz astrolojik, aşk/kariyer/şans tüyoları içeren 3-4 cümlelik günlük burç yorumu yap.`;
            const { callAIProviders } = require('./aiManager');
            const horoscope = await callAIProviders([
                { role: 'system', content: 'Sen astrolojiye ve burçlara hakim, esprili ve tatlı dilli bir astroloji danışmanısın.' },
                { role: 'user', content: prompt }
            ]);
            return horoscope ? `🔮 **[${sign.toUpperCase()} Burcu Günlük Yorumu]:**\n\n${horoscope}` : '🔮 Yıldızlar şu an biraz sisli görünüyor!';
        }

        case 'write_lyrics': {
            const topic = params.topic || 'Discord sohbeti ve yazılımcı hayatı';
            const style = params.style || 'rap veya şiir';
            const prompt = `"${topic}" konusu hakkında kafiyeli, akıcı, ritmik ve zekice 2 kıtalık bir ${style} yaz.`;
            const { callAIProviders } = require('./aiManager');
            const lyrics = await callAIProviders([
                { role: 'system', content: 'Sen yetenekli bir şair ve söz yazısısın. Kafiyeleri ve ritmi kusursuz kullanırsın.' },
                { role: 'user', content: prompt }
            ]);
            return lyrics ? `🎤 **[AI Söz Yazarı - ${topic}]:**\n\n${lyrics}` : '🎤 İlham perileri şu an meşgul!';
        }

        case 'adventure_rpg': {
            const action = params.choice || params.action || 'başlangıç';
            const prompt = `Kullanıcıyla interaktif bir metin tabanlı RPG macera oyunu oynuyoruz. Kullanıcının hamlesi: "${action}". Durumu 2 cümleyle heyecanlı şekilde anlat ve ardından oyuncunun seçebileceği 3 numaralı seçenek (1, 2, 3) sun.`;
            const { callAIProviders } = require('./aiManager');
            const story = await callAIProviders([
                { role: 'system', content: 'Sen heyecanlı bir Dungeons & Dragons / RPG oyun yöneticisisin (Dungeon Master).' },
                { role: 'user', content: prompt }
            ]);
            return story ? `⚔️ **[Metin Tabanlı RPG Macerası]:**\n\n${story}\n\n*(Devam etmek için seçtiğin numarayı yazabilirsin)*` : '⚔️ Zindanda fener söndü!';
        }

                case 'publish_bulletin': {
            const { generateAndPublishBulletin } = require('./bultenManager');
            const res = await generateAndPublishBulletin(guild, member.user);
            return `📰 Haftalık sunucu gazetesi hazırlandı ve **${res.channel}** kanalında yayınlandı!`;
        }

        default:
            return null;
    }
}

module.exports = { executeAction };
