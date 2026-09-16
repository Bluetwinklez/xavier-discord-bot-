const {
    Events,
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const { getSettings, setSettings } = require('../utils/database');
const { THEMES, customThemes, getThemePreviewEmbed, applyThemeToGuild } = require('../utils/themeCatalog');
const { pendingOrganizePlans, executeOrganization } = require('../utils/channelOrganizer');
const { renderAiPanel } = require('../utils/aiPanel');
const { sendServerLog } = require('../utils/serverLog');
const logger = require('../utils/logger');

// Salt-okunur/bilgi amaçlı komutlar log kanalını gürültüyle doldurmasın diye hariç tutulur
const COMMAND_LOG_EXCLUDE = new Set([
    'ping', 'yardim', 'seviye', 'liderlik-tablosu', 'hava-durumu', 'kur',
    'sozluk', 'saka', 'tavsiye', 'sunucubilgi', 'kullanicibilgi', 'kuyruk',
    'ai-panel', 'uyarilar'
]);

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Bazı buton/select dalları (panel ayarları, giveaway katılımı, tema iptali vb.) kendi
        // try/catch'ini içermiyordu — biri patlarsa kullanıcı Discord'un genel "Bu etkileşim
        // başarısız oldu" mesajını görüyordu, hiçbir anlamlı geri bildirim almıyordu. İçerideki
        // dalların çoğu zaten kendi try/catch'ini doğru kullanıyor (bu dış katman onları etkilemez,
        // sadece hiç sarılmamış olanlar için son bir güvenlik ağı).
        try {
        // 1. Slash Komutları İşleme
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`Komut bulunamadı: ${interaction.commandName}`);
                return;
            }

            try {
                await command.execute(interaction);

                if (interaction.guild && !COMMAND_LOG_EXCLUDE.has(interaction.commandName)) {
                    sendServerLog(interaction.guild, {
                        title: '⚙️ Komut Kullanıldı',
                        color: 0x99AAB5,
                        fields: [
                            { name: 'Komut', value: `/${interaction.commandName}`, inline: true },
                            { name: 'Kullanıcı', value: `${interaction.user.tag}`, inline: true },
                            { name: 'Kanal', value: `${interaction.channel}`, inline: true }
                        ]
                    }).catch(() => {});
                }
            } catch (error) {
                logger.error(`Komut çalıştırma hatası (${interaction.commandName}):`, error);
                const replyOptions = {
                    content: '❌ Bu komut yürütülürken bir hata oluştu!',
                    ephemeral: true
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(replyOptions);
                } else {
                    await interaction.reply(replyOptions);
                }
            }
            return;
        }

        // 2. Açılır Menü (Select Menu) Etkileşimleri - Tema Önizleme
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'select_theme') {
                const selectedThemeId = interaction.values[0];
                const theme = THEMES[selectedThemeId];

                if (!theme) {
                    return interaction.reply({ content: '❌ Seçilen tema bulunamadı!', ephemeral: true });
                }

                const previewEmbed = getThemePreviewEmbed(theme);

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`apply_theme_${selectedThemeId}`)
                        .setLabel('✅ Mevcut Kanallara Ekle')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`confirm_wipe_${selectedThemeId}`)
                        .setLabel('⚠️ Sıfırla ve Temayı Kur')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('cancel_theme')
                        .setLabel('❌ İptal Et')
                        .setStyle(ButtonStyle.Secondary)
                );

                await interaction.update({
                    content: `🔍 **Seçilen Tema Önizlemesi:** Aşağıdaki kanalları ve rolleri inceleyiniz:\n• **Mevcut Kanallara Ekle**: Eski kanallara dokunmadan yenilerini açar.\n• **Sıfırla ve Temayı Kur**: Eski tüm kanalları temizleyip sıfırdan kurar.`,
                    embeds: [previewEmbed],
                    components: [buttons]
                });
                return;
            }

            // AI Kontrol Paneli - Mod Seçimi
            if (interaction.customId === 'panel_ai_persona') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Bu paneli kullanmak için Yönetici yetkisine sahip olmalısınız!', ephemeral: true });
                }
                setSettings(interaction.guildId, { aiPersona: interaction.values[0] });
                const view = await renderAiPanel(interaction.guild);
                await interaction.update(view);
                return;
            }

            // Self-Rol Seçim Menüsü: seçilenler eklenir, listede olup seçilmeyenler çıkarılır
            if (interaction.customId === 'self_role_select') {
                const settings = getSettings(interaction.guildId);
                const selfRoleIds = (settings.selfRoles || []).map(r => r.roleId);
                const selectedIds = interaction.values;

                try {
                    const toAdd = selectedIds.filter(id => !interaction.member.roles.cache.has(id));
                    const toRemove = selfRoleIds.filter(id => !selectedIds.includes(id) && interaction.member.roles.cache.has(id));

                    for (const id of toAdd) await interaction.member.roles.add(id).catch(() => {});
                    for (const id of toRemove) await interaction.member.roles.remove(id).catch(() => {});

                    const addedNames = toAdd.map(id => interaction.guild.roles.cache.get(id)?.name).filter(Boolean);
                    const removedNames = toRemove.map(id => interaction.guild.roles.cache.get(id)?.name).filter(Boolean);

                    const parts = [];
                    if (addedNames.length) parts.push(`✅ Eklendi: ${addedNames.join(', ')}`);
                    if (removedNames.length) parts.push(`🗑️ Çıkarıldı: ${removedNames.join(', ')}`);
                    if (!parts.length) parts.push('ℹ️ Rollerinde değişiklik olmadı.');

                    await interaction.reply({ content: parts.join('\n'), ephemeral: true });
                } catch (err) {
                    logger.error('Self-rol güncelleme hatası:', err);
                    await interaction.reply({ content: '❌ Roller güncellenirken hata oluştu. Botun rolü, verilen rollerden yukarıda olmalı.', ephemeral: true });
                }
                return;
            }
        }

        // 2.5 Kanal / Rol Seçim Menüleri - AI Kontrol Paneli
        if (interaction.isChannelSelectMenu() && interaction.customId === 'panel_ai_channel') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Bu paneli kullanmak için Yönetici yetkisine sahip olmalısınız!', ephemeral: true });
            }
            setSettings(interaction.guildId, { aiChannelId: interaction.values[0] });
            const view = await renderAiPanel(interaction.guild);
            await interaction.update(view);
            return;
        }

        if (interaction.isRoleSelectMenu() && interaction.customId === 'panel_ai_role') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Bu paneli kullanmak için Yönetici yetkisine sahip olmalısınız!', ephemeral: true });
            }
            setSettings(interaction.guildId, { aiRoleId: interaction.values[0] });
            const view = await renderAiPanel(interaction.guild);
            await interaction.update(view);
            return;
        }

        if (interaction.isRoleSelectMenu() && interaction.customId === 'panel_ai_manager_role') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Bu paneli kullanmak için Yönetici yetkisine sahip olmalısınız!', ephemeral: true });
            }
            setSettings(interaction.guildId, { aiManagerRoleId: interaction.values[0] });
            const view = await renderAiPanel(interaction.guild);
            await interaction.update(view);
            return;
        }

        // 3. Buton Etkileşimleri (Ticket Sistemi, Tema Onay/Sıfırlama/İptal)
        if (interaction.isButton()) {
            const { handleCodeButton } = require('../utils/codeHelper');
            if (await handleCodeButton(interaction)) return;
            const customId = interaction.customId;

            // Sıfırlama Öncesi 2. Adım Tehlike Onayı
            if (customId.startsWith('confirm_wipe_')) {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Bu işlemi gerçekleştirmek için Yönetici yetkisine sahip olmalısınız!', ephemeral: true });
                }

                const themeId = customId.replace('confirm_wipe_', '');
                const theme = THEMES[themeId] || customThemes.get(themeId);

                const dangerEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('🚨 DİKKAT: TÜM KANALLAR KALICI OLARAK SİLİNECEK!')
                    .setDescription(
                        `Bu işlem sunucunuzdaki **mevcut tüm metin, ses ve kategori kanallarını tamamen silecektir!**\n\n` +
                        `Ardından **${theme?.name || 'Seçilen tema'}** sıfırdan temiz bir sunucuya kurulacaktır.\n\n` +
                        `⚠️ *Eski mesajlar, resimler ve kanallar geri getirilemez! Devam etmek istediğinize kesinlikle emin misiniz?*`
                    )
                    .setTimestamp();

                const dangerRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`do_wipe_${themeId}`)
                        .setLabel('🚨 Evet, Hepsini Sil ve Sıfırdan Kur')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('cancel_theme')
                        .setLabel('❌ Vazgeç / İptal Et')
                        .setStyle(ButtonStyle.Secondary)
                );

                await interaction.update({
                    content: null,
                    embeds: [dangerEmbed],
                    components: [dangerRow]
                });
                return;
            }

            // Sıfırlamayı Gerçekleştir ve Temayı Kur
            if (customId.startsWith('do_wipe_')) {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Bu işlemi gerçekleştirmek için Yönetici yetkisine sahip olmalısınız!', ephemeral: true });
                }

                const themeId = customId.replace('do_wipe_', '');
                const theme = THEMES[themeId] || customThemes.get(themeId);

                if (!theme) {
                    return interaction.reply({ content: '❌ Tema bilgisi bulunamadı!', ephemeral: true });
                }

                await interaction.deferUpdate();
                try {
                    await applyThemeToGuild(interaction.guild, theme, interaction, true);
                } catch (err) {
                    console.error('Sıfırlama ve tema kurulum hatası:', err);
                    await interaction.editReply({ content: `❌ Sıfırlama sırasında hata oluştu: ${err.message}`, embeds: [], components: [] });
                }
                return;
            }

            // Normal Tema Kurulum Onayı (Kanalları Silmeden Ekle)
            if (customId.startsWith('apply_theme_')) {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Bu işlemi gerçekleştirmek için Yönetici (Administrator) yetkisine sahip olmalısınız!', ephemeral: true });
                }

                const themeId = customId.replace('apply_theme_', '');
                const theme = THEMES[themeId] || customThemes.get(themeId);

                if (!theme) {
                    return interaction.reply({ content: '❌ Tema bilgisi zaman aşımına uğradı veya bulunamadı, lütfen tekrar deneyin.', ephemeral: true });
                }

                await interaction.deferUpdate();
                try {
                    await applyThemeToGuild(interaction.guild, theme, interaction, false);
                } catch (err) {
                    console.error('Tema kurulum hatası:', err);
                    await interaction.editReply({ content: `❌ Kurulum sırasında bir hata oluştu: ${err.message}`, embeds: [], components: [] });
                }
                return;
            }

            // Tema Kurulum İptali
            if (customId === 'cancel_theme') {
                await interaction.update({
                    content: '❌ Tema kurulum işlemi iptal edildi. Sunucunuzda herhangi bir kanal veya rol değiştirilmedi.',
                    embeds: [],
                    components: []
                });
                return;
            }

            // Kanal Düzenleme Onayı
            if (customId === 'apply_organize') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Bu işlemi gerçekleştirmek için Yönetici yetkisine sahip olmalısınız!', ephemeral: true });
                }

                const plan = pendingOrganizePlans.get(interaction.guildId);
                if (!plan || plan.length === 0) {
                    return interaction.reply({ content: '❌ Düzenleme planı zaman aşımına uğradı, lütfen `/kanallari-duzenle` komutunu tekrar çalıştırın.', ephemeral: true });
                }

                await interaction.deferUpdate();
                try {
                    await executeOrganization(interaction.guild, plan, interaction);
                    pendingOrganizePlans.delete(interaction.guildId);
                } catch (err) {
                    console.error('Kanal düzenleme hatası:', err);
                    await interaction.editReply({ content: `❌ Kanallar düzenlenirken bir hata oluştu: ${err.message}`, embeds: [], components: [] });
                }
                return;
            }

            // AI Kontrol Paneli - Kanal Kısıtını Kaldır
            if (customId === 'panel_ai_reset_channel') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Bu paneli kullanmak için Yönetici yetkisine sahip olmalısınız!', ephemeral: true });
                }
                setSettings(interaction.guildId, { aiChannelId: null });
                const view = await renderAiPanel(interaction.guild);
                await interaction.update(view);
                return;
            }

            // AI Kontrol Paneli - Rol Kısıtını Kaldır
            if (customId === 'panel_ai_reset_role') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Bu paneli kullanmak için Yönetici yetkisine sahip olmalısınız!', ephemeral: true });
                }
                setSettings(interaction.guildId, { aiRoleId: null });
                const view = await renderAiPanel(interaction.guild);
                await interaction.update(view);
                return;
            }

            // AI Kontrol Paneli - Yönetici Rolünü Kaldır
            if (customId === 'panel_ai_reset_manager_role') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Bu paneli kullanmak için Yönetici yetkisine sahip olmalısınız!', ephemeral: true });
                }
                setSettings(interaction.guildId, { aiManagerRoleId: null });
                const view = await renderAiPanel(interaction.guild);
                await interaction.update(view);
                return;
            }

            // AI Kontrol Paneli - Yönetici Rolü Oluştur
            if (customId === 'panel_ai_create_manager_role') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Bu paneli kullanmak için Yönetici yetkisine sahip olmalısınız!', ephemeral: true });
                }
                try {
                    const existing = interaction.guild.roles.cache.find(r => r.name === '🎖️ AI Yönetici');
                    const role = existing || await interaction.guild.roles.create({
                        name: '🎖️ AI Yönetici',
                        color: 0xF1C40F,
                        hoist: true,
                        reason: 'AI Yönetici rolü /ai-panel üzerinden oluşturuldu'
                    });
                    setSettings(interaction.guildId, { aiManagerRoleId: role.id });
                    const view = await renderAiPanel(interaction.guild);
                    await interaction.update(view);
                } catch (err) {
                    logger.error('AI Yönetici rolü oluşturma hatası:', err);
                    await interaction.reply({ content: '❌ Rol oluşturulamadı, botun `Rolleri Yönet` yetkisi olduğundan emin olun.', ephemeral: true });
                }
                return;
            }

            // AI Kontrol Paneli - Yenile
            if (customId === 'panel_ai_refresh') {
                const view = await renderAiPanel(interaction.guild);
                await interaction.update(view);
                return;
            }

            // Kanal Düzenleme İptali
            if (customId === 'cancel_organize') {
                pendingOrganizePlans.delete(interaction.guildId);
                await interaction.update({
                    content: '❌ Kanal düzenleme işlemi iptal edildi. Kanallarınızda hiçbir değişiklik yapılmadı.',
                    embeds: [],
                    components: []
                });
                return;
            }

            // Destek Talebi Aç Butonu
            if (customId === 'open_ticket') {
                const guild = interaction.guild;
                const user = interaction.user;

                const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9]/g, '') || 'destek';
                // Kullanıcının halihazırda açık bir ticket kanalı olup olmadığını kontrol et
                const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${cleanUsername}`);
                if (existingChannel) {
                    return interaction.reply({
                        content: `❌ Zaten açık bir destek talebiniz bulunuyor: ${existingChannel}`,
                        ephemeral: true
                    });
                }

                const settings = getSettings(guild.id);
                let parentCategory = null;
                if (settings.ticketCategoryId) {
                    const cat = guild.channels.cache.get(settings.ticketCategoryId);
                    if (cat && cat.type === ChannelType.GuildCategory) {
                        parentCategory = cat.id;
                    } else {
                        // Kategori sunucudan silinmiş, geçersiz ID'yi temizle
                        setSettings(guild.id, { ticketCategoryId: null });
                    }
                }

                try {
                    const permissionOverwrites = [
                        {
                            id: guild.id, // @everyone rolü (herkes için gizli)
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        {
                            id: user.id, // Talep açan kullanıcı
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.AttachFiles,
                                PermissionFlagsBits.ReadMessageHistory
                            ]
                        },
                        {
                            id: interaction.client.user.id, // Bot
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ManageChannels
                            ]
                        }
                    ];

                    // /ticket-kur'da bir yetkili rol tanımlanmışsa o rol de kanalı görebilsin —
                    // eskiden hiçbir rol overwrite'ı eklenmiyordu, panel metni "yetkililerle
                    // görebileceğiniz" dese de gerçekte sadece Yöneticiler (izin bypass'ı sayesinde)
                    // ve talebi açan kişi görebiliyordu.
                    if (settings.ticketStaffRoleId && guild.roles.cache.has(settings.ticketStaffRoleId)) {
                        permissionOverwrites.push({
                            id: settings.ticketStaffRoleId,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ReadMessageHistory
                            ]
                        });
                    }

                    let ticketChannel;
                    try {
                        ticketChannel = await guild.channels.create({
                            name: `ticket-${cleanUsername}`,
                            type: ChannelType.GuildText,
                            parent: parentCategory,
                            permissionOverwrites
                        });
                    } catch (catErr) {
                        if (parentCategory) {
                            // Kategori silinmiş veya geçersizse kategorisiz oluştur
                            setSettings(guild.id, { ticketCategoryId: null });
                            ticketChannel = await guild.channels.create({
                                name: `ticket-${cleanUsername}`,
                                type: ChannelType.GuildText,
                                permissionOverwrites
                            });
                        } else {
                            throw catErr;
                        }
                    }

                    const ticketEmbed = new EmbedBuilder()
                        .setColor(0x5865F2)
                        .setTitle(`🎫 Destek Talebi: ${user.tag}`)
                        .setDescription(`Merhaba ${user}, yetkili ekibimiz en kısa sürede size yardımcı olacaktır.\nLütfen sorununuzu detaylı bir şekilde buraya yazınız.`)
                        .addFields(
                            { name: '👤 Talep Sahibi', value: `${user} (\`${user.id}\`)`, inline: true },
                            { name: '⏰ Açılış Zamanı', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                        )
                        .setTimestamp();

                    const closeRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('close_ticket')
                            .setLabel('Talebi Kapat')
                            .setEmoji('🔒')
                            .setStyle(ButtonStyle.Danger)
                    );

                    await ticketChannel.send({
                        content: `${user} Destek talebiniz oluşturuldu!`,
                        embeds: [ticketEmbed],
                        components: [closeRow]
                    });

                    await interaction.reply({
                        content: `✅ Destek talebiniz oluşturuldu: ${ticketChannel}`,
                        ephemeral: true
                    });

                    sendServerLog(guild, {
                        title: '🎫 Destek Talebi Açıldı',
                        color: 0x5865F2,
                        fields: [
                            { name: '👤 Kullanıcı', value: `${user.tag} (\`${user.id}\`)`, inline: true },
                            { name: '📍 Kanal', value: `${ticketChannel}`, inline: true }
                        ]
                    }).catch(() => {});
                } catch (error) {
                    logger.error('Ticket kanalı açma hatası:', error);
                    await interaction.reply({
                        content: '❌ Destek kanalı oluşturulurken bir hata oluştu! Botun `ManageChannels` yetkisine sahip olduğundan emin olun.',
                        ephemeral: true
                    });
                }
                return;
            }

            // Müzik Kontrol Butonları ("Şimdi Oynatılıyor" panelindeki)
            if (customId === 'music_pauseresume' || customId === 'music_skip' || customId === 'music_loop' || customId === 'music_shuffle' || customId === 'music_stop') {
                const musicManager = require('../utils/musicManager');
                const memberVoice = interaction.member.voice.channel;
                const queue = musicManager.getQueue(interaction.guildId);

                if (!queue) {
                    return interaction.reply({ content: '❌ Şu an aktif bir müzik yayını yok.', ephemeral: true });
                }
                if (!memberVoice || memberVoice.id !== queue.voiceChannel.id) {
                    return interaction.reply({ content: '❌ Bu kontrolleri kullanmak için botla aynı ses kanalında olmalısınız.', ephemeral: true });
                }

                if (customId === 'music_pauseresume') {
                    const state = musicManager.togglePause(interaction.guildId);
                    return interaction.reply({ content: state === 'paused' ? '⏸️ Müzik duraklatıldı.' : '▶️ Müzik devam ediyor.', ephemeral: true });
                }
                if (customId === 'music_skip') {
                    const skipped = musicManager.skipSong(interaction.guildId);
                    return interaction.reply({ content: skipped ? `⏭️ Geçildi: **${skipped.title}**` : '❌ Geçilecek şarkı yok.', ephemeral: true });
                }
                if (customId === 'music_loop') {
                    const loop = musicManager.toggleLoop(interaction.guildId);
                    return interaction.reply({ content: loop ? '🔁 Tekrar modu açıldı.' : '🔁 Tekrar modu kapatıldı.', ephemeral: true });
                }
                if (customId === 'music_shuffle') {
                    const count = musicManager.shuffleQueue(interaction.guildId);
                    return interaction.reply({ content: count > 0 ? `🔀 Kuyruk karıştırıldı (${count} parça).` : '❌ Karıştırmak için kuyrukta yeterli şarkı yok.', ephemeral: true });
                }
                if (customId === 'music_stop') {
                    musicManager.stopMusic(interaction.guildId);
                    return interaction.reply({ content: '⏹️ Müzik durduruldu ve kuyruk temizlendi.', ephemeral: true });
                }
                return;
            }

            // Çekiliş - Katıl Butonu
            if (customId === 'giveaway_join') {
                const { joinGiveaway } = require('../utils/giveawayManager');
                const result = joinGiveaway(interaction.message.id, interaction.user.id);

                if (!result.ok && result.reason === 'not_found') {
                    return interaction.reply({ content: '❌ Bu çekiliş artık aktif değil.', ephemeral: true });
                }
                if (!result.ok && result.reason === 'already_joined') {
                    return interaction.reply({ content: `ℹ️ Zaten katıldın! (Toplam katılımcı: ${result.count})`, ephemeral: true });
                }
                return interaction.reply({ content: `🎉 Çekilişe katıldın! (Toplam katılımcı: ${result.count})`, ephemeral: true });
            }

            // Kayıt Sistemi - Kayıt Ol Butonu
            // Eskiden butona basınca DİREKT rol veriliyordu — hiçbir doğrulama olmadığı için
            // bot/alt-hesap akınları (raid sırasında otomatik tıklayan scriptler) tek tıkla kayıt
            // olabiliyordu. Artık kısa bir kod içeren modal (form) gösteriyoruz; kodu doğru yazan
            // gerçek bir insan olduğunu göstermiş oluyor (tam captcha değil ama otomatik
            // buton-tıklayan basit botları/scriptleri caydırır).
            if (customId === 'register_member') {
                const settings = getSettings(interaction.guildId);
                if (!settings.registeredRoleId) {
                    return interaction.reply({ content: '❌ Kayıt sistemi düzgün ayarlanmamış, bir yetkiliye bildirin.', ephemeral: true });
                }
                const code = Math.random().toString(36).slice(2, 6).toUpperCase();
                const modal = new ModalBuilder()
                    .setCustomId(`register_captcha_${code}`)
                    .setTitle('İnsan Doğrulaması');
                const input = new TextInputBuilder()
                    .setCustomId('captcha_answer')
                    .setLabel(`Bu kodu aynen yazın: ${code}`)
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(4)
                    .setMaxLength(4)
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }

            // Talebi Kapat Butonu
            if (customId === 'close_ticket') {
                await interaction.reply('🔒 Destek talebi kapatılıyor... Bu kanal 5 saniye içinde silinecektir.');

                // Eskiden kanal silinince konuşma geçmişi TAMAMEN kayboluyordu. Kapatmadan önce
                // mesaj geçmişini düz metin transkripte çevirip log kanalına ekli olarak gönderiyoruz
                // (log kanalı ayarlı değilse sendServerLog zaten sessizce hiçbir şey yapmıyor —
                // diğer log türleriyle aynı, ekstra bir kayıp değil).
                let transcriptFile = null;
                try {
                    const allMessages = [];
                    let lastId;
                    while (allMessages.length < 500) {
                        const batch = await interaction.channel.messages.fetch({ limit: 100, before: lastId }).catch(() => null);
                        if (!batch || batch.size === 0) break;
                        allMessages.push(...batch.values());
                        lastId = batch.last()?.id;
                        if (batch.size < 100) break;
                    }
                    allMessages.reverse();
                    const lines = allMessages.map(m => {
                        const time = m.createdAt.toISOString().replace('T', ' ').slice(0, 19);
                        const text = m.content || (m.embeds.length ? '[embed]' : m.attachments.size ? '[dosya]' : '');
                        return `[${time}] ${m.author.tag}: ${text}`;
                    });
                    if (lines.length > 0) {
                        transcriptFile = {
                            name: `transcript-${interaction.channel.name}.txt`,
                            attachment: Buffer.from(lines.join('\n'), 'utf-8')
                        };
                    }
                } catch (err) {
                    logger.error('Ticket transkripti oluşturulamadı:', err);
                }

                sendServerLog(interaction.guild, {
                    title: '🔒 Destek Talebi Kapatıldı',
                    color: 0x99AAB5,
                    fields: [
                        { name: '📍 Kanal', value: `#${interaction.channel.name}`, inline: true },
                        { name: '🛡️ Kapatan', value: `${interaction.user.tag}`, inline: true }
                    ],
                    files: transcriptFile ? [transcriptFile] : undefined
                }).catch(() => {});

                setTimeout(async () => {
                    try {
                        await interaction.channel.delete('Ticket kapatıldı.');
                    } catch (error) {
                        logger.error('Kanal silinemedi:', error);
                    }
                }, 5000);
            }
        }

        // 4. Modal (Form) Gönderimleri — şu an sadece kayıt doğrulama kodu için kullanılıyor
        if (interaction.isModalSubmit() && interaction.customId.startsWith('register_captcha_')) {
            const expectedCode = interaction.customId.replace('register_captcha_', '');
            const answer = (interaction.fields.getTextInputValue('captcha_answer') || '').trim().toUpperCase();

            if (answer !== expectedCode) {
                return interaction.reply({ content: '❌ Kod yanlış girildi. "Kayıt Ol" butonuna tekrar basıp yeni kodu deneyin.', ephemeral: true });
            }

            const settings = getSettings(interaction.guildId);
            if (!settings.registeredRoleId) {
                return interaction.reply({ content: '❌ Kayıt sistemi düzgün ayarlanmamış, bir yetkiliye bildirin.', ephemeral: true });
            }
            try {
                if (settings.unregisteredRoleId) {
                    await interaction.member.roles.remove(settings.unregisteredRoleId).catch(() => {});
                }
                await interaction.member.roles.add(settings.registeredRoleId);
                await interaction.reply({ content: '✅ Doğrulandın, kaydın tamamlandı — sunucuya hoş geldin!', ephemeral: true });

                sendServerLog(interaction.guild, {
                    title: '📝 Üye Kayıt Oldu',
                    color: 0x2ECC71,
                    fields: [{ name: '👤 Kullanıcı', value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: true }]
                }).catch(() => {});
            } catch (err) {
                logger.error('Kayıt işlemi hatası:', err);
                await interaction.reply({ content: '❌ Kayıt işlemi sırasında hata oluştu. Botun rolü, verilecek/alınacak rollerden yukarıda ve `Rolleri Yönet` yetkisine sahip olduğundan emin olun.', ephemeral: true });
            }
        }
        } catch (error) {
            logger.error('interactionCreate işlenirken beklenmeyen hata:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Beklenmeyen bir hata oluştu.', ephemeral: true }).catch(() => {});
            }
        }
    },
};
