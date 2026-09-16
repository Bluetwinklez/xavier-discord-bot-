const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { generateAndPublishBulletin } = require('../../utils/bultenManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bulten-yayinla')
        .setDescription('Özel bülten kanalını oluşturur ve yapay zeka ile haftalık sunucu gazetesini yayınlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const { channel, message } = await generateAndPublishBulletin(interaction.guild, interaction.user);

            const replyEmbed = new EmbedBuilder()
                .setColor(0x00FF88)
                .setTitle('📰 Haftalık Bülten Başarıyla Yayınlandı!')
                .setDescription(`Özel bülten kanalınız ${channel} oluşturuldu/kontrol edildi ve yapay zekanın hazırladığı gazete oraya gönderildi!\n\n👉 [Bülteni Okumak İçin Tıklayın](${message.url})`)
                .setTimestamp();

            await interaction.editReply({ embeds: [replyEmbed] });
        } catch (err) {
            console.error('bulten-yayinla hatası:', err);
            await interaction.editReply('❌ Bülten oluşturulurken bir hata oluştu: ' + err.message);
        }
    },
};
