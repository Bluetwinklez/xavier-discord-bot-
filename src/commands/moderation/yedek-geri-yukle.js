const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getBackup, restoreBackup } = require('../../utils/backupManager');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yedek-geri-yukle')
        .setDescription('Belirtilen yedekte olup sunucuda artık bulunmayan rol/kanalları yeniden oluşturur.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('yedek-id')
                .setDescription('/yedek-listele ile gördüğünüz yedek ID\'si')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.Administrator)) return;

        const backupId = interaction.options.getString('yedek-id');

        const backup = getBackup(interaction.guildId, backupId);
        if (!backup) {
            return interaction.reply({ content: '❌ Bu ID ile bir yedek bulunamadı. `/yedek-listele` ile mevcut yedekleri görebilirsiniz.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            const result = await restoreBackup(interaction.guild, backupId);
            await interaction.editReply(
                `✅ Geri yükleme tamamlandı!\n` +
                `🎭 **${result.rolesCreated}** rol yeniden oluşturuldu.\n` +
                `📁 **${result.channelsCreated}** kanal yeniden oluşturuldu.\n\n` +
                `*Not: Bu işlem sadece EKSİK olanları oluşturur, mevcut hiçbir şeyi silmez veya değiştirmez.*`
            );
        } catch (error) {
            console.error('Yedek geri yükleme hatası:', error);
            await interaction.editReply('❌ Geri yükleme sırasında bir hata oluştu.');
        }
    },
};
