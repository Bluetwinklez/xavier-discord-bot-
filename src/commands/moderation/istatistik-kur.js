const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setupStatsChannels } = require('../../utils/statsChannels');
const { getSettings } = require('../../utils/database');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('istatistik-kur')
        .setDescription('Kendini güncelleyen üye/bot/boost sayacı ses kanalları oluşturur.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.Administrator)) return;

        if (getSettings(interaction.guildId).statsChannels) {
            return interaction.reply({ content: 'ℹ️ İstatistik kanalları zaten kurulu. Önce `/istatistik-kaldir` ile kaldırabilirsiniz.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            await setupStatsChannels(interaction.guild);
            await interaction.editReply('📊 İstatistik kanalları oluşturuldu! Sayılar her 10 dakikada bir otomatik güncellenir (Discord kanal adı değiştirme sınırı nedeniyle).');
        } catch (error) {
            console.error('İstatistik kurulum hatası:', error);
            await interaction.editReply('❌ İstatistik kanalları oluşturulurken bir hata oluştu.');
        }
    },
};
