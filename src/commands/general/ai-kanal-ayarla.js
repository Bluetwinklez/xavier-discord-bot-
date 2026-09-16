const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { setSettings } = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ai-kanal-ayarla')
        .setDescription('Kullanıcıların etiket atmadan yapay zeka ile doğrudan konuşabileceği kanalı belirler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Yapay zeka sohbet kanalı olarak atanacak metin kanalı')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),
    async execute(interaction) {
        const channel = interaction.options.getChannel('kanal');

        setSettings(interaction.guildId, { aiChannelId: channel.id });

        const embed = new EmbedBuilder()
            .setColor(0x00FF88)
            .setTitle('🧠 AI Sohbet Kanalı Ayarlandı')
            .setDescription(`Artık ${channel} kanalına yazılan her mesaja **OpenClaw AI** otomatik olarak cevap verecektir.`)
            .addFields(
                { name: '💡 İpucu', value: 'Kullanıcılar botu etiketlemeye gerek kalmadan bu kanalda doğrudan soru sorabilir ve sohbet edebilir.' }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
