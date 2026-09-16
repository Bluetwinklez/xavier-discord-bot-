const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tavsiye')
        .setDescription('Rastgele (İngilizce) bir hayat tavsiyesi gönderir. (Kaynak: Advice Slip API, API anahtarı gerekmez)'),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const res = await fetch('https://api.adviceslip.com/advice', { cache: 'no-store' });
            const data = await res.json();

            const embed = new EmbedBuilder()
                .setColor(0x00D2D3)
                .setTitle('💡 Günün Tavsiyesi')
                .setDescription(data.slip?.advice || 'Tavsiye alınamadı.')
                .setFooter({ text: 'Kaynak: Advice Slip API (İngilizce)' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Tavsiye hatası:', error);
            await interaction.editReply('❌ Tavsiye alınırken bir hata oluştu.');
        }
    },
};
