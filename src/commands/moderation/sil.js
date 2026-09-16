const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendServerLog } = require('../../utils/serverLog');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sil')
        .setDescription('Kanalda belirtilen miktarda mesajı topluca siler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option.setName('sayi')
                .setDescription('Silinecek mesaj sayısı (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.ManageMessages)) return;

        const amount = interaction.options.getInteger('sayi');

        try {
            const deleted = await interaction.channel.bulkDelete(amount, true);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setDescription(`🧹 Başarıyla **${deleted.size}** adet mesaj silindi.`)
                .setFooter({ text: '14 günden eski mesajlar Discord kısıtlaması nedeniyle toplu silinemez.' });

            await interaction.reply({ embeds: [embed], ephemeral: true });

            sendServerLog(interaction.guild, {
                title: '🧹 Toplu Mesaj Silindi',
                color: 0x00FF00,
                fields: [
                    { name: '📍 Kanal', value: `${interaction.channel}`, inline: true },
                    { name: '🔢 Miktar', value: `${deleted.size}`, inline: true },
                    { name: '🛡️ Yetkili', value: `${interaction.user.tag}`, inline: true }
                ]
            }).catch(() => {});
        } catch (error) {
            console.error('Mesaj silme hatası:', error);
            await interaction.reply({ content: '❌ Mesajlar silinirken bir hata oluştu veya yetkim yetersiz!', ephemeral: true });
        }
    },
};
