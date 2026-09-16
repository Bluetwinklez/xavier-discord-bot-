const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { clearWarns } = require('../../utils/warnManager');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uyarilari-temizle')
        .setDescription('Bir kullanıcının TÜM uyarılarını temizler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Uyarıları temizlenecek kullanıcı')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.Administrator)) return;

        const targetUser = interaction.options.getUser('kullanici');
        const count = clearWarns(interaction.guildId, targetUser.id);

        await interaction.reply(count > 0
            ? `✅ **${targetUser.tag}** kullanıcısının **${count}** uyarısı temizlendi.`
            : `ℹ️ **${targetUser.tag}** kullanıcısının zaten hiç uyarısı yok.`);
    },
};
