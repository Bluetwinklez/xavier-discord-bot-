const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const {
    pendingOrganizePlans,
    analyzeGuildChannels,
    getOrganizationPreviewEmbed
} = require('../../utils/channelOrganizer');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kanallari-duzenle')
        .setDescription('Mevcut kanalları silmeden estetik emojilerle ve tematik formatta düzenler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.Administrator)) return;

        const guild = interaction.guild;
        const plan = analyzeGuildChannels(guild);

        if (plan.length === 0) {
            return interaction.reply({
                content: '✅ Sunucunuzdaki kanallar zaten temiz, emojili ve tematik olarak düzenli görünüyor!',
                ephemeral: true
            });
        }

        pendingOrganizePlans.set(guild.id, plan);

        const previewEmbed = getOrganizationPreviewEmbed(guild, plan);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('apply_organize')
                .setLabel('✅ Değişiklikleri Uygula')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('cancel_organize')
                .setLabel('❌ İptal Et')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
            embeds: [previewEmbed],
            components: [row],
            ephemeral: true
        });
    },
};
