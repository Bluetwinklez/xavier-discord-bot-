const { SlashCommandBuilder } = require('discord.js');
const { getTempVoice, isTempVoice } = require('../../utils/tempVoiceManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oda-limit')
        .setDescription('Sahibi olduğunuz geçici ses odasının kişi sınırını ayarlar.')
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Odaya girebilecek maksimum kişi sayısı (0 = Limitsiz, 1-99)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(99)
        ),
    async execute(interaction) {
        const member = interaction.member;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ Bir ses kanalında olmalısınız!', ephemeral: true });
        }

        if (!isTempVoice(voiceChannel.id)) {
            return interaction.reply({ content: '❌ Bulunduğunuz kanal yönetilebilir bir geçici oda değil!', ephemeral: true });
        }

        const roomData = getTempVoice(voiceChannel.id);
        if (roomData.ownerId !== member.id && !member.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ Bu odanın sahibi siz değilsiniz!', ephemeral: true });
        }

        const limit = interaction.options.getInteger('limit');

        try {
            await voiceChannel.setUserLimit(limit);
            await interaction.reply({
                content: limit === 0
                    ? '✅ Odanızın kişi sınırı kaldırıldı (Limitsiz).'
                    : `✅ Odanızın kişi sınırı **${limit} kişi** olarak ayarlandı.`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Oda limiti ayarlanamadı:', error);
            await interaction.reply({ content: '❌ Oda limiti ayarlanırken bir hata oluştu!', ephemeral: true });
        }
    },
};
