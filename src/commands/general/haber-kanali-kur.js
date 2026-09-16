const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { setSettings } = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('haber-kanali-kur')
        .setDescription('Otomatik teknoloji ve yapay zeka haberleri kanalını kurar ve ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply();

        let channel = interaction.guild.channels.cache.find(
            c => c.type === ChannelType.GuildText && c.name.includes('teknoloji-gundemi')
        );

        if (!channel) {
            channel = await interaction.guild.channels.create({
                name: '⚡┃teknoloji-gundemi',
                type: ChannelType.GuildText,
                topic: '⚡ Güncel Yapay Zeka, Yazılım ve Teknoloji Haber Akışı',
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.SendMessages] // Sadece bot haber paylaşsın
                    },
                    {
                        id: interaction.client.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
                    }
                ]
            });
        }

        setSettings(interaction.guildId, { techNewsChannelId: channel.id });

        const infoEmbed = new EmbedBuilder()
            .setColor(0x00AAFF)
            .setTitle('⚡ Teknoloji & Yapay Zeka Gündemi Başladı!')
            .setDescription('Bu kanal, dünyadaki en sıcak yapay zeka, yazılım ve teknoloji gelişmelerini takip edebilmeniz için kuruldu.\n\n' +
                '• `/haber-paylas` yazarak anında en güncel haberleri kanala çekebilirsiniz.\n' +
                '• Günlük otomatik haber akışı bu kanala gönderilir.')
            .setTimestamp();

        await channel.send({ embeds: [infoEmbed] });

        await interaction.editReply(`✅ Teknoloji gündemi kanalı başarıyla kuruldu: ${channel}`);
    },
};
