const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('saka')
        .setDescription('Rastgele (İngilizce) bir şaka gönderir. (Kaynak: JokeAPI, API anahtarı gerekmez)'),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const res = await fetch('https://v2.jokeapi.dev/joke/Any?safe-mode&lang=en');
            const data = await res.json();

            if (data.error) {
                return interaction.editReply('❌ Şu anda şaka servisine ulaşılamıyor, tekrar deneyin.');
            }

            const text = data.type === 'twopart'
                ? `${data.setup}\n\n||${data.delivery}||`
                : data.joke;

            const embed = new EmbedBuilder()
                .setColor(0xFEE75C)
                .setTitle('😄 Rastgele Şaka')
                .setDescription(text)
                .setFooter({ text: 'Kaynak: JokeAPI (İngilizce) · Spoiler\'a tıkla' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Şaka hatası:', error);
            await interaction.editReply('❌ Şaka alınırken bir hata oluştu.');
        }
    },
};
