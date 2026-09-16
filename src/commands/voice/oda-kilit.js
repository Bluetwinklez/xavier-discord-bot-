const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getTempVoice, isTempVoice } = require('../../utils/tempVoiceManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oda-kilit')
        .setDescription('Sahibi olduğunuz geçici odayı başkalarının girişine kilitler veya kilidi açar.'),
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

        const everyoneRole = interaction.guild.roles.everyone;
        const currentOverwrite = voiceChannel.permissionOverwrites.cache.get(everyoneRole.id);
        const isLocked = currentOverwrite && currentOverwrite.deny.has(PermissionFlagsBits.Connect);

        try {
            if (isLocked) {
                // Kilidi aç
                await voiceChannel.permissionOverwrites.edit(everyoneRole, {
                    Connect: true
                });
                await interaction.reply({ content: '🔓 Odanın kilidi açıldı! Artık herkes odaya girebilir.', ephemeral: true });
            } else {
                // Odayı kilitle
                await voiceChannel.permissionOverwrites.edit(everyoneRole, {
                    Connect: false
                });
                await interaction.reply({ content: '🔒 Oda kilitlendi! Artık siz izin vermedikçe kimse odaya giremez.', ephemeral: true });
            }
        } catch (error) {
            console.error('Kilit değiştirme hatası:', error);
            await interaction.reply({ content: '❌ Oda kilit durumu değiştirilirken hata oluştu!', ephemeral: true });
        }
    },
};
