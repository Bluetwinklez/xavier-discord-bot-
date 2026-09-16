const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { setSettings } = require('../../utils/database');
const { getRulesEmbeds } = require('../../utils/rulesTemplate');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sunucu-kur')
        .setDescription('Sunucuyu Gaming / Oyun Topluluğu temasına göre otomatik olarak yapılandırır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.Administrator)) return;

        const guild = interaction.guild;
        await interaction.deferReply({ ephemeral: true });

        try {
            await interaction.editReply('⏳ Gaming temalı roller oluşturuluyor...');

            // 1. Rol Tanımları ve Oluşturma
            const rolesToCreate = [
                { name: '🛡️ Yönetici', color: 0xE74C3C, permissions: [PermissionFlagsBits.Administrator] },
                { name: '⚔️ Moderatör', color: 0xE67E22, permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers] },
                { name: '🌟 VIP Oyuncu', color: 0x9B59B6, permissions: [] },
                { name: '🎮 Gamer', color: 0x2ECC71, permissions: [] },
                { name: '🎯 Valorant', color: 0xFD4556, permissions: [] },
                { name: '⚔️ LoL', color: 0x0AC8B9, permissions: [] },
                { name: '💣 CS2', color: 0xDE9B35, permissions: [] },
                { name: '⛏️ Minecraft', color: 0x5B8731, permissions: [] },
                { name: '👥 Üye', color: 0x3498DB, permissions: [] }
            ];

            const createdRoles = {};
            for (const r of rolesToCreate) {
                let role = guild.roles.cache.find(roleItem => roleItem.name === r.name);
                if (!role) {
                    role = await guild.roles.create({
                        name: r.name,
                        color: r.color,
                        permissions: r.permissions,
                        hoist: true, // Üye listesinde ayrı göster
                        reason: 'Gaming sunucu şablonu kurulumu'
                    });
                }
                createdRoles[r.name] = role;
            }

            await interaction.editReply('⏳ Kategoriler ve kanallar dizayn ediliyor...');

            // 2. Kategori 1: Bilgi & Duyuru
            const infoCategory = await guild.channels.create({
                name: '📢 │ BİLGİ & DUYURU',
                type: ChannelType.GuildCategory
            });

            // Kurallar kanalı (Herkes okuyabilir, sadece yetkili yazabilir)
            const rulesChannel = await guild.channels.create({
                name: '📜│kurallar',
                type: ChannelType.GuildText,
                parent: infoCategory.id,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.SendMessages] }
                ]
            });

            await guild.channels.create({
                name: '📢│duyurular',
                type: ChannelType.GuildText,
                parent: infoCategory.id,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.SendMessages] }
                ]
            });

            await guild.channels.create({
                name: '🎉│etkinlik-ve-cekilis',
                type: ChannelType.GuildText,
                parent: infoCategory.id,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.SendMessages] }
                ]
            });

            // Hoş geldin kanalı
            const welcomeChannel = await guild.channels.create({
                name: '👋│hos-geldin',
                type: ChannelType.GuildText,
                parent: infoCategory.id,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.SendMessages] }
                ]
            });

            // 3. Kategori 2: Topluluk & Sohbet
            const chatCategory = await guild.channels.create({
                name: '💬 │ TOPLULUK & SOHBET',
                type: ChannelType.GuildCategory
            });

            await guild.channels.create({ name: '💬│genel-sohbet', type: ChannelType.GuildText, parent: chatCategory.id });
            await guild.channels.create({ name: '🤖│bot-komut', type: ChannelType.GuildText, parent: chatCategory.id });
            await guild.channels.create({ name: '📷│klipler-ve-ss', type: ChannelType.GuildText, parent: chatCategory.id });
            await guild.channels.create({ name: '🔍│oyuncu-ara-lfg', type: ChannelType.GuildText, parent: chatCategory.id });

            // 4. Kategori 3: Oyun Odaları
            const gamesCategory = await guild.channels.create({
                name: '🎮 │ OYUN ODALARI',
                type: ChannelType.GuildCategory
            });

            await guild.channels.create({ name: '🎯│valorant', type: ChannelType.GuildText, parent: gamesCategory.id });
            await guild.channels.create({ name: '⚔️│lol', type: ChannelType.GuildText, parent: gamesCategory.id });
            await guild.channels.create({ name: '💣│cs2', type: ChannelType.GuildText, parent: gamesCategory.id });
            await guild.channels.create({ name: '⛏️│minecraft', type: ChannelType.GuildText, parent: gamesCategory.id });

            // 5. Kategori 4: Destek Merkezi
            const ticketCategory = await guild.channels.create({
                name: '🎫 │ DESTEK MERKEZİ',
                type: ChannelType.GuildCategory
            });

            const ticketChannel = await guild.channels.create({
                name: '🎫│destek-talebi',
                type: ChannelType.GuildText,
                parent: ticketCategory.id,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.SendMessages] }
                ]
            });

            // 6. Kategori 5: Ses Kanalları
            const voiceCategory = await guild.channels.create({
                name: '🔊 │ SES KANALLARI',
                type: ChannelType.GuildCategory
            });

            // Geçici Ses Odaları için Hub Kanalı
            const tempHubChannel = await guild.channels.create({
                name: '➕ │ Oda Oluştur',
                type: ChannelType.GuildVoice,
                parent: voiceCategory.id,
                userLimit: 1
            });

            await guild.channels.create({ name: '🔊 │ Sohbet Odası 1', type: ChannelType.GuildVoice, parent: voiceCategory.id });
            await guild.channels.create({ name: '🔊 │ Sohbet Odası 2', type: ChannelType.GuildVoice, parent: voiceCategory.id });
            await guild.channels.create({ name: '🎵 │ Müzik Odası', type: ChannelType.GuildVoice, parent: voiceCategory.id });
            await guild.channels.create({ name: '🎮 │ Duo Odası 1 (2P)', type: ChannelType.GuildVoice, parent: voiceCategory.id, userLimit: 2 });
            await guild.channels.create({ name: '🎮 │ Duo Odası 2 (2P)', type: ChannelType.GuildVoice, parent: voiceCategory.id, userLimit: 2 });
            await guild.channels.create({ name: '🎮 │ Squad Odası (5P)', type: ChannelType.GuildVoice, parent: voiceCategory.id, userLimit: 5 });
            await guild.channels.create({ name: '💤 │ AFK', type: ChannelType.GuildVoice, parent: voiceCategory.id });

            await interaction.editReply('⏳ Kurallar ve ticket panelleri yerleştiriliyor...');

            // Kurallar panosu ve afişini kurallar kanalına gönder
            const { embeds: ruleEmbeds, files: ruleFiles } = getRulesEmbeds();
            await rulesChannel.send({ embeds: ruleEmbeds, files: ruleFiles });

            // Destek panosunu ticket kanalına gönder
            const ticketEmbed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🎫 Gaming Topluluğu Destek Sistemi')
                .setDescription('Yetkili ekibimizle özel olarak görüşmek, şikayet, öneri veya oyuncu bildirmek için aşağıdaki butona tıklayabilirsiniz.')
                .setFooter({ text: 'Gereksiz yere talep açılması ceza sebebidir.' });

            const ticketRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('open_ticket')
                    .setLabel('Destek Talebi Aç')
                    .setEmoji('📩')
                    .setStyle(ButtonStyle.Primary)
            );

            await ticketChannel.send({ embeds: [ticketEmbed], components: [ticketRow] });

            // Bot ayarlarını otomatik senkronize et (database)
            setSettings(guild.id, {
                welcomeChannelId: welcomeChannel.id,
                autoRoleId: createdRoles['👥 Üye']?.id || null,
                ticketCategoryId: ticketCategory.id,
                tempVoiceHubId: tempHubChannel.id
            });

            const successEmbed = new EmbedBuilder()
                .setColor(0x00FF88)
                .setTitle('🎉 Gaming Sunucu Kurulumu Tamamlandı!')
                .setDescription('Sunucunuz modern Gaming & Oyuncu Topluluğu temasına göre baştan aşağı başarıyla yapılandırıldı!')
                .addFields(
                    { name: '🎭 Oluşturulan Roller', value: '`Yönetici`, `Moderatör`, `VIP`, `Gamer`, `Valorant`, `LoL`, `CS2`, `Minecraft`, `Üye`' },
                    { name: '📁 Kategoriler', value: '`BİLGİ & DUYURU`, `TOPLULUK & SOHBET`, `OYUN ODALARI`, `DESTEK MERKEZİ`, `SES KANALLARI`' },
                    { name: '📜 Kurallar Panosu', value: `${rulesChannel} kanalına afişle birlikte asıldı.` },
                    { name: '🎫 Destek Paneli', value: `${ticketChannel} kanalına butonlu olarak yerleştirildi.` },
                    { name: '🤖 Otomatik Entegrasyon', value: `Hoş geldin kanalı ${welcomeChannel} ve Oto-Rol \`👥 Üye\` olarak ayarlandı.` }
                )
                .setFooter({ text: 'Discord.js v14 Gaming Setup' })
                .setTimestamp();

            await interaction.editReply({ content: null, embeds: [successEmbed] });
        } catch (error) {
            console.error('Sunucu kurma hatası:', error);
            await interaction.editReply(`❌ Sunucu kurulurken bir hata oluştu: ${error.message}\n(Botun sunucuda en üst rolde ve Yönetici yetkisine sahip olduğundan emin olun.)`);
        }
    },
};
