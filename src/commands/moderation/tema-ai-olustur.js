const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require('discord.js');
const { generateJSON } = require('../../utils/aiManager');
const { customThemes, getThemePreviewEmbed, validateThemeSchema } = require('../../utils/themeCatalog');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tema-ai-olustur')
        .setDescription('Yapay zeka ile belirttiğiniz özel bir konuya göre sunucu kanalları ve rolleri tasarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('konu')
                .setDescription('İstediğiniz sunucu konusu (Örn: Formula 1 Kulübü, Rock Müzik Grubu, Kripto Para Topluluğu)')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.Administrator)) return;

        const topic = interaction.options.getString('konu');
        await interaction.deferReply({ ephemeral: true });

        const prompt = `Kullanıcı Discord sunucusu için şu temada özel kanal ve rol mimarisi istiyor: "${topic}".
Lütfen SADECE geçerli bir JSON nesnesi üret. Başka hiçbir markdown veya açıklama yazma.
JSON şablonu tam olarak şöyle olmalıdır:
{
  "name": "Emoji + Tema Adı",
  "description": "Temanın 1 cümlelik açıklaması",
  "roles": [
    { "name": "🛡️ Rol Adı", "color": 15158332 },
    { "name": "👥 Rol Adı 2", "color": 3447003 }
  ],
  "categories": [
    {
      "name": "📢 │ BİLGİ & DUYURU",
      "channels": [
        { "name": "📜│kurallar", "type": 0, "readonly": true },
        { "name": "👋│hos-geldin", "type": 0, "readonly": true, "isWelcome": true }
      ]
    },
    {
      "name": "💬 │ TOPLULUK & SOHBET",
      "channels": [
        { "name": "💬│genel-sohbet", "type": 0 }
      ]
    },
    {
      "name": "🔊 │ SES KANALLARI",
      "channels": [
        { "name": "➕ │ Oda Oluştur", "type": 2, "userLimit": 1, "isTempHub": true },
        { "name": "🔊 │ Sohbet Odası 1", "type": 2 }
      ]
    }
  ]
}
Not: type 0 metin kanalı (GuildText), type 2 ses kanalıdır (GuildVoice). En az 4 kategori ve 10-15 kanal oluştur.`;

        try {
            const aiResponse = await generateJSON(prompt);

            // JSON metnini ayıkla
            let jsonText = (aiResponse || '').trim();
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonText = jsonMatch[0];
            }

            const buildFallbackTheme = () => ({
                name: `🌟 ${topic} Topluluğu`,
                description: `${topic} için özel olarak tasarlanmış sunucu teması.`,
                color: 0x5865F2,
                roles: [
                    { name: '👑 Yönetici', color: 0xE74C3C, permissions: [PermissionFlagsBits.Administrator] },
                    { name: '🛡️ Moderatör', color: 0xE67E22 },
                    { name: `⭐ ${topic} Uzmanı`, color: 0x9B59B6 },
                    { name: '👥 Üye', color: 0x3498DB }
                ],
                categories: [
                    {
                        name: '📢 │ DUYURU & BİLGİ',
                        channels: [
                            { name: '📜│kurallar', type: ChannelType.GuildText, readonly: true },
                            { name: '📢│duyurular', type: ChannelType.GuildText, readonly: true },
                            { name: '👋│hos-geldin', type: ChannelType.GuildText, readonly: true, isWelcome: true }
                        ]
                    },
                    {
                        name: '💬 │ TOPLULUK & SOHBET',
                        channels: [
                            { name: '💬│genel-sohbet', type: ChannelType.GuildText },
                            { name: '💡│fikir-ve-tartisma', type: ChannelType.GuildText },
                            { name: '📸│medya-paylasim', type: ChannelType.GuildText }
                        ]
                    },
                    {
                        name: '🔊 │ SES KANALLARI',
                        channels: [
                            { name: '➕ │ Oda Oluştur', type: ChannelType.GuildVoice, userLimit: 1, isTempHub: true },
                            { name: '🔊 │ Sohbet 1', type: ChannelType.GuildVoice },
                            { name: '🔊 │ Sohbet 2', type: ChannelType.GuildVoice }
                        ]
                    }
                ]
            });

            let themeData;
            try {
                themeData = JSON.parse(jsonText);
            } catch {
                themeData = buildFallbackTheme();
            }

            // JSON.parse BAŞARILI olsa bile üretilen yapı bozuk olabilir (yanlış tip, eksik alan,
            // sınır dışı değer) — eskiden bu hiç kontrol edilmiyordu ve "Sıfırla ve Kur" seçilirse
            // tüm kanallar silindikten SONRA bu bozuk veriyle oluşturma denenip yarım kalabiliyordu.
            const schemaCheck = validateThemeSchema(themeData);
            if (!schemaCheck.valid) {
                console.warn(`[tema-ai-olustur] AI şeması geçersiz (${schemaCheck.error}), güvenli şablona düşülüyor.`);
                themeData = buildFallbackTheme();
            }

            // Temaya id ve renk ata
            const themeId = `custom_${Date.now()}`;
            themeData.id = themeId;
            themeData.color = themeData.color || 0x00FF88;

            customThemes.set(themeId, themeData);

            const previewEmbed = getThemePreviewEmbed(themeData);

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`apply_theme_${themeId}`)
                    .setLabel('✅ Mevcut Kanallara Ekle')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`confirm_wipe_${themeId}`)
                    .setLabel('⚠️ Sıfırla ve Temayı Kur')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_theme')
                    .setLabel('❌ İptal Et')
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.editReply({
                content: `🤖 **Yapay Zeka "${topic}" için özel bir tema tasarladı!**\nAşağıdaki önizlemeyi inceleyip yeşil butona basarak sunucunuza kurabilirsiniz:`,
                embeds: [previewEmbed],
                components: [buttons]
            });
        } catch (error) {
            console.error('AI tema oluşturma hatası:', error);
            await interaction.editReply({ content: '❌ Yapay zeka tema tasarlarken bir hata oluştu, lütfen tekrar deneyin.' });
        }
    },
};
