const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { listBackups } = require('../../utils/backupManager');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yedek-listele')
        .setDescription('Bu sunucu için alınmış yedekleri listeler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.Administrator)) return;

        const backups = listBackups(interaction.guildId);

        if (backups.length === 0) {
            return interaction.reply({ content: 'ℹ️ Bu sunucu için henüz bir yedek alınmamış. `/yedek-al` ile başlayabilirsiniz.', ephemeral: true });
        }

        const lines = backups.map(b =>
            `🆔 \`${b.id}\` — <t:${Math.floor(b.createdAt / 1000)}:f> — ${b.roleCount} rol, ${b.channelCount} kanal`
        );

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('💾 Sunucu Yedekleri')
            .setDescription(lines.join('\n'))
            .setFooter({ text: 'En fazla 5 yedek saklanır. Geri yüklemek için: /yedek-geri-yukle yedek-id:<ID>' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
