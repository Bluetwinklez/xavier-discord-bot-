const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const { THEMES } = require('../../utils/themeCatalog');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tema-sec')
        .setDescription('Sunucunuz için hazır temaları listeler, önizlemesini gösterir ve onayınızla kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.Administrator)) return;

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
