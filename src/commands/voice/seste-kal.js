const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { set247Voice } = require('../../utils/radioCatalog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seste-kal')
        .setDescription('Botu seçilen ses kanalına kalıcı (7/24) olarak bağlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Botun 7/24 kalacağı ses kanalı')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(false)
        ),
    async execute(interaction) {
        let voiceChannel = interaction.options.getChannel('kanal');

        if (!voiceChannel) {
            voiceChannel = interaction.member.voice?.channel;
        }

        if (!voiceChannel) {
            return interaction.reply({
                content: '❌ Lütfen bir ses kanalı belirtin veya bir ses kanalına katılın.',
                ephemeral: true
            });
        }

        try {
            await set247Voice(voiceChannel);

            const embed = new EmbedBuilder()
                .setColor(0x00FF88)
                .setTitle('🎙️ 7/24 Seste Kalma Modu Aktif!')
                .setDescription(`Bot başarıyla **${voiceChannel.name}** kanalına bağlandı.\nBağlantı kopsa bile bot otomatik olarak bu kanala yeniden bağlanacaktır.`)
                .setFooter({ text: 'Devre dışı bırakmak için /sesten-ayril komutunu kullanabilirsiniz.' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Seste kalma hatası:', error);
            await interaction.reply({ content: `❌ Ses kanalına bağlanılamadı: ${error.message}`, ephemeral: true });
        }
    },
};
