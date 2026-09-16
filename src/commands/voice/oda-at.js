const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getTempVoice, isTempVoice } = require('../../utils/tempVoiceManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oda-at')
        .setDescription('Sahibi olduğunuz geçici ses odasından bir kullanıcıyı çıkartır.')
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Odadan atılacak kullanıcı')
                .setRequired(true)
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

        const targetUser = interaction.options.getUser('kullanici');
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            return interaction.reply({ content: '❌ Kullanıcı bulunamadı!', ephemeral: true });
        }

        if (targetMember.id === member.id) {
            return interaction.reply({ content: '❌ Kendinizi odadan atamazsınız!', ephemeral: true });
        }

        try {
            // Kullanıcının odaya tekrar girmesini engelle
            await voiceChannel.permissionOverwrites.edit(targetMember, {
                Connect: false
            });

            // Eğer şu an o odadaysa bağlantısını kes
            if (targetMember.voice.channelId === voiceChannel.id) {
                await targetMember.voice.disconnect('Oda sahibi tarafından odadan çıkarıldı.');
            }

            await interaction.reply({
                content: `👢 ${targetUser} başarıyla odanızdan çıkarıldı ve tekrar girişi engellendi.`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Odadan atma hatası:', error);
            await interaction.reply({ content: '❌ Kullanıcı odadan çıkarılırken bir hata oluştu!', ephemeral: true });
        }
    },
};
