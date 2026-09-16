const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { removeWarn } = require('../../utils/warnManager');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uyari-sil')
        .setDescription('Bir kullanıcının belirli bir uyarısını siler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Uyarısı silinecek kullanıcı')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('uyari-id')
                .setDescription('/uyarilar ile gördüğünüz uyarı numarası (#)')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.Administrator)) return;

        const targetUser = interaction.options.getUser('kullanici');
        const warnId = interaction.options.getInteger('uyari-id');

        const removed = removeWarn(interaction.guildId, targetUser.id, warnId);

        await interaction.reply(removed
            ? `🗑️ **${targetUser.tag}** kullanıcısının **#${warnId}** numaralı uyarısı silindi.`
            : `❌ Bu numarada bir uyarı bulunamadı.`);
    },
};
