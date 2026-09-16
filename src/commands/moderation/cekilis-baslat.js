const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { startGiveaway } = require('../../utils/giveawayManager');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cekilis-baslat')
        .setDescription('Butonla katılımlı, süreli bir çekiliş başlatır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(option =>
            option.setName('odul')
                .setDescription('Çekilişte verilecek ödül')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('sure-dakika')
                .setDescription('Çekilişin süresi (dakika)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10080)
        )
        .addIntegerOption(option =>
            option.setName('kazanan-sayisi')
                .setDescription('Kaç kişi kazanacak (varsayılan: 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(20)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.ManageGuild)) return;

        const prize = interaction.options.getString('odul');
        const durationMinutes = interaction.options.getInteger('sure-dakika');
        const winnerCount = interaction.options.getInteger('kazanan-sayisi') || 1;

        await startGiveaway(interaction.channel, {
            prize,
            durationMinutes,
            winnerCount,
            host: interaction.user
        });

        await interaction.reply({ content: `✅ Çekiliş başlatıldı: **${prize}**`, ephemeral: true });
    },
};
