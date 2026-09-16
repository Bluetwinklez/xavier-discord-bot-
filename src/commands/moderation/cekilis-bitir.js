const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { endGiveaway, getGiveaway } = require('../../utils/giveawayManager');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cekilis-bitir')
        .setDescription('Devam eden bir çekilişi erken bitirir ve kazananı seçer.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(option =>
            option.setName('mesaj-id')
                .setDescription('Çekiliş mesajının ID\'si (mesaja sağ tık > Mesaj Kimliğini Kopyala)')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.ManageGuild)) return;

        const messageId = interaction.options.getString('mesaj-id').trim();

        if (!getGiveaway(messageId)) {
            return interaction.reply({ content: '❌ Bu ID ile aktif bir çekiliş bulunamadı.', ephemeral: true });
        }

        await interaction.reply({ content: '🏁 Çekiliş bitiriliyor...', ephemeral: true });
        await endGiveaway(messageId);
    },
};
