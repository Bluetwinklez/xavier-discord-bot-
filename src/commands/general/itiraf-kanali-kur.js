const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { setSettings } = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('itiraf-kanali-kur')
        .setDescription('Anonim itiraf kanalını oluşturur ve ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.deferReply();

        let channel = interaction.guild.channels.cache.find(
            c => c.type === ChannelType.GuildText && c.name.includes('anonim-itiraflar')
        );

        if (!channel) {
            channel = await interaction.guild.channels.create({
                name: '🎭┃anonim-itiraflar',
                type: ChannelType.GuildText,
                topic: '🎭 Anonim İtiraflar: Kimliğiniz tamamen gizli kalacak şekilde /itiraf-et komutu ile itiraf yapın!',
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.SendMessages] // Sadece bot itiraf atsın
                    },
                    {
                        id: interaction.client.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AddReactions]
                    }
                ]
            });
        }

        setSettings(interaction.guildId, { confessionChannelId: channel.id });

        const infoEmbed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('🎭 Anonim İtiraf Kutusu Açıldı!')
            .setDescription('İçinde sakladığın her şeyi kimliğin **%100 gizli** kalacak şekilde paylaşabilirsin.\n\n' +
                '👉 **Nasıl İtiraf Edilir?**\n' +
                'Sunucunun herhangi bir yerinde `/itiraf-et mesaj: <itirafınız>` yazın.\n\n' +
                '🔒 *Kimliğiniz sunucu yöneticileri de dahil olmak üzere hiç kimseyle paylaşılmaz.*')
            .setTimestamp();

        await channel.send({ embeds: [infoEmbed] });

        await interaction.editReply(`✅ Anonim itiraf kanalı başarıyla kuruldu: ${channel}`);
    },
};
