const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const { THEMES, customThemes, getThemePreviewEmbed, validateThemeSchema } = require('../../utils/themeCatalog');
const { convertTemplateToTheme } = require('../../utils/discordTemplateImporter');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tema-sec')
        .setDescription('Sunucunuz için hazır temaları listeler, önizlemesini gösterir ve onayınızla kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('sablon-linki')
                .setDescription('discord.new/... veya discord.com/template/... linki verirsen şablonu içe aktarır')
                .setRequired(false)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.Administrator)) return;

        const templateLink = interaction.options.getString('sablon-linki');
        if (templateLink) {
            await interaction.deferReply({ ephemeral: true });
            try {
                const template = await interaction.client.fetchGuildTemplate(templateLink);
                let themeData = convertTemplateToTheme(template);

                const schemaCheck = validateThemeSchema(themeData);
                if (!schemaCheck.valid) {
                    return interaction.editReply(`❌ Şablon içe aktarılamadı: dönüştürülen yapı geçersiz (${schemaCheck.error}).`);
                }

                const themeId = `template_${Date.now()}`;
                themeData.id = themeId;
                customThemes.set(themeId, themeData);

                const previewEmbed = getThemePreviewEmbed(themeData);
                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`apply_theme_${themeId}`).setLabel('✅ Mevcut Kanallara Ekle').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`confirm_wipe_${themeId}`).setLabel('⚠️ Sıfırla ve Temayı Kur').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('cancel_theme').setLabel('❌ İptal Et').setStyle(ButtonStyle.Secondary)
                );

                return interaction.editReply({
                    content: `📥 **Şablon başarıyla okundu: "${template.name}"**\nAşağıdaki önizlemeyi inceleyip yeşil butona basarak sunucunuza kurabilirsiniz:\n*(Not: duyuru/forum/stage gibi özel kanal tipleri en yakın metin/ses kanalına dönüştürülür, özel izin ayarları basitleştirilir.)*`,
                    embeds: [previewEmbed],
                    components: [buttons]
                });
            } catch (err) {
                console.error('Şablon içe aktarma hatası:', err);
                return interaction.editReply(`❌ Şablon okunamadı: ${err.message}\nLinkin doğru olduğundan ve şablonun hâlâ mevcut olduğundan emin ol.`);
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎨 Sunucu Tema Seçim ve Önizleme Merkezi')
            .setDescription(
                'Aşağıdaki menüden sunucunuz için bir tema seçerek **kurulum öncesi hangi kanalların ve rollerin açılacağını detaylı olarak inceleyebilirsiniz!**\n\n' +
                '📌 **Nasıl Çalışır?**\n' +
                '1. Açılır menüden beğendiğiniz temayı seçin.\n' +
                '2. Bot size açılacak tüm kategorilerin ve kanalların haritasını önizleme olarak sunacaktır.\n' +
                '3. Beğenirseniz **"✅ Bu Temayı Sunucuma Kur"** butonuna basarak onaylayabilirsiniz.'
            )
            .setFooter({ text: 'Onay vermediğiniz sürece sunucunuzda hiçbir değişiklik yapılmaz.' })
            .setTimestamp();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_theme')
            .setPlaceholder('Lütfen incelemek istediğiniz temayı seçin...')
            .addOptions(
                Object.values(THEMES).map(theme =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(theme.name)
                        .setDescription(theme.description.slice(0, 95))
                        .setValue(theme.id)
                )
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    },
};
