const { SlashCommandBuilder } = require('discord.js');
const { getTempVoice, isTempVoice } = require('../../utils/tempVoiceManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oda-isim')
        .setDescription('Sahibi olduğunuz geçici ses odasının adını değiştirir.')
        .addStringOption(option =>
            option.setName('yeni_ad')
                .setDescription('Odanın yeni adı')
                .setRequired(true)
                .setMaxLength(50)
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

        const newName = interaction.options.getString('yeni_ad');

        try {
            await voiceChannel.setName(`🔊 │ ${newName}`);
            await interaction.reply({ content: `✅ Odanızın adı **🔊 │ ${newName}** olarak değiştirildi!`, ephemeral: true });
        } catch (error) {
            console.error('Oda adı değiştirilemedi:', error);
            await interaction.reply({ content: '❌ Discord kısıtlaması nedeniyle kanal adı hemen değiştirilemedi (Lütfen biraz bekleyip tekrar deneyin).', ephemeral: true });
        }
    },
};
