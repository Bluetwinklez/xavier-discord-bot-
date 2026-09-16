const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getModHistory } = require('../../utils/moderationHistory');
const { getWarns } = require('../../utils/warnManager');
const { requirePermission } = require('../../utils/permissionGuard');

const TYPE_LABELS = {
    ban: '🔨 Ban',
    kick: '👢 Kick',
    timeout: '🔇 Timeout',
    warn: '⚠️ Uyarı'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('moderasyon-gecmisi')
        .setDescription('Bir kullanıcının ban/kick/timeout/uyarı geçmişini tek ekranda gösterir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Geçmişi görüntülenecek kullanıcı')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.ModerateMembers)) return;

        const targetUser = interaction.options.getUser('kullanici');

        const modActions = getModHistory(interaction.guildId, targetUser.id).map(a => ({ ...a, type: a.type }));
        const warns = getWarns(interaction.guildId, targetUser.id).map(w => ({ type: 'warn', reason: w.reason, moderatorId: w.moderatorId, timestamp: w.timestamp }));

        const combined = [...modActions, ...warns].sort((a, b) => b.timestamp - a.timestamp);

        if (combined.length === 0) {
            return interaction.reply({ content: `✅ **${targetUser.tag}** kullanıcısının hiç moderasyon geçmişi yok.`, ephemeral: true });
        }

        const lines = combined.slice(0, 15).map(a =>
            `${TYPE_LABELS[a.type] || a.type} — <t:${Math.floor(a.timestamp / 1000)}:d> — ${a.reason} (<@${a.moderatorId}>)`
        );

        const embed = new EmbedBuilder()
            .setColor(0x99AAB5)
            .setTitle(`📋 ${targetUser.tag} — Moderasyon Geçmişi`)
            .setDescription(lines.join('\n'))
            .setFooter({ text: `Toplam: ${combined.length} kayıt${combined.length > 15 ? ' (son 15 gösteriliyor)' : ''}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
