const { SlashCommandBuilder } = require('discord.js');
const { playTTS } = require('../../utils/radioCatalog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seslendir')
        .setDescription('Yazdığınız Türkçe metni ses kanalında bot seslendirir (TTS).')
        .addStringOption(option =>
            option.setName('metin')
                .setDescription('Seslendirilecek mesaj (Maksimum 200 karakter)')
                .setMaxLength(200)
                .setRequired(true)
        ),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice?.channel;

        if (!voiceChannel) {
            return interaction.reply({
                content: '❌ Metin seslendirebilmek için bir ses kanalında olmalısınız!',
                ephemeral: true
            });
        }

        const text = interaction.options.getString('metin');

        await interaction.deferReply();

        try {
            await playTTS(voiceChannel, text);
            await interaction.editReply({
                content: `🗣️ **Seslendirildi:** *"${text}"*`
            });
        } catch (error) {
            console.error('TTS hatası:', error);
            await interaction.editReply({ content: `❌ Seslendirme başarısız: ${error.message}` });
        }
    },
};
