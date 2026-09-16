const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { createBackup } = require('../../utils/backupManager');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yedek-al')
        .setDescription('Sunucunun mevcut rol ve kanal yapısının bir yedeğini alır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.Administrator)) return;

        await interaction.deferReply();

        try {
            const backup = createBackup(interaction.guild);
            const channelCount = backup.categories.reduce((sum, c) => sum + c.channels.length, 0) + backup.orphanChannels.length;

            const embed = new EmbedBuilder()
                .setColor(0x00FF88)
                .setTitle('💾 Sunucu Yedeği Alındı')
                .addFields(
                    { name: '🆔 Yedek ID', value: `\`${backup.id}\``, inline: true },
                    { name: '🎭 Rol Sayısı', value: `${backup.roles.length}`, inline: true },
                    { name: '📁 Kanal Sayısı', value: `${channelCount}`, inline: true }
                )
                .setFooter({ text: 'Geri yüklemek için: /yedek-geri-yukle yedek-id:' + backup.id })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Yedek alma hatası:', error);
            await interaction.editReply('❌ Yedek alınırken bir hata oluştu.');
        }
    },
};
