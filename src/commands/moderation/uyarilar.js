const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getWarns } = require('../../utils/warnManager');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uyarilar')
        .setDescription('Bir kullanıcının uyarı geçmişini gösterir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Uyarıları görüntülenecek kullanıcı')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.ModerateMembers)) return;

        const targetUser = interaction.options.getUser('kullanici');
        const warns = getWarns(interaction.guildId, targetUser.id);

        if (warns.length === 0) {
            return interaction.reply({ content: `✅ **${targetUser.tag}** kullanıcısının hiç uyarısı yok.`, ephemeral: true });
        }

        const lines = warns.map(w => `\`#${w.id}\` <t:${Math.floor(w.timestamp / 1000)}:d> — ${w.reason} (<@${w.moderatorId}>)`);

        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle(`⚠️ ${targetUser.tag} — Uyarı Geçmişi (${warns.length})`)
            .setDescription(lines.join('\n'))
            .setFooter({ text: 'Silmek için: /uyari-sil' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
