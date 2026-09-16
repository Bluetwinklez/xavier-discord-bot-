const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setLockdown, isLockdown } = require('../../utils/antiRaidManager');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guvenlik-kilidi')
        .setDescription('Sunucuyu acil durumlarda kilitler (Anti-Raid) veya kilidi açar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt =>
            opt.setName('durum')
                .setDescription('Güvenlik kilidi durumu')
                .setRequired(true)
                .addChoices(
                    { name: '🔒 Kilidi Aç (Korumayı Aktif Et)', value: 'ac' },
                    { name: '🔓 Kilidi Kapat (Normale Dön)', value: 'kapat' },
                    { name: '❓ Durumu Kontrol Et', value: 'kontrol' }
                )
        ),

    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.Administrator)) return;

        const action = interaction.options.getString('durum');
        const active = isLockdown(interaction.guildId);

        if (action === 'kontrol') {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(active ? 0xED4245 : 0x00FF88)
                        .setTitle('🛡️ Anti-Raid Güvenlik Durumu')
                        .setDescription(`Sunucu Güvenlik Kilidi şu anda: **${active ? '🔒 KİLİTLİ (Anti-Raid Aktif)' : '🔓 NORMALE DÖNDÜ'}**`)
                        .setTimestamp()
                ]
            });
        }

        if (action === 'ac') {
            setLockdown(interaction.guildId, true);
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle('🔒 Güvenlik Kilidi Devreye Alındı!')
                        .setDescription('Sunucu manuel olarak **Güvenlik Kilidi (Lockdown)** moduna alındı. Şüpheli toplu girişler engellenir.')
                        .setTimestamp()
                ]
            });
        }

        if (action === 'kapat') {
            setLockdown(interaction.guildId, false);
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x00FF88)
                        .setTitle('🔓 Güvenlik Kilidi Kaldırıldı')
                        .setDescription('Sunucu normal çalışma moduna döndürüldü.')
                        .setTimestamp()
                ]
            });
        }
    },
};
