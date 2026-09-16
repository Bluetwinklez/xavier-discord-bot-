const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { removeStatsChannels } = require('../../utils/statsChannels');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('istatistik-kaldir')
        .setDescription('İstatistik sayacı kanallarını ve kategorisini kaldırır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.Administrator)) return;

        await interaction.deferReply();
        const removed = await removeStatsChannels(interaction.guild);
        await interaction.editReply(removed ? '🗑️ İstatistik kanalları kaldırıldı.' : 'ℹ️ Kurulu istatistik kanalı bulunamadı.');
    },
};
