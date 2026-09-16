const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { setSettings, getSettings } = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giriscikis-ayarla')
        .setDescription('Sunucuya yeni üye katıldığında veya ayrıldığında mesaj gönderilecek kanalı ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Karşılama mesajlarının gideceği metin kanalı')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),
    async execute(interaction) {
        const channel = interaction.options.getChannel('kanal');

        setSettings(interaction.guildId, { welcomeChannelId: channel.id });

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Karşılama Kanalı Ayarlandı')
            .setDescription(`Yeni üyeler katıldığında veya ayrıldığında bildirimler ${channel} kanalına gönderilecek.`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
