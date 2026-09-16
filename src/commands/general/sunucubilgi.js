const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sunucubilgi')
        .setDescription('Mevcut sunucu hakkında genel bilgileri gösterir.'),
    async execute(interaction) {
        const guild = interaction.guild;
        const owner = await guild.fetchOwner();
        
        const totalMembers = guild.memberCount;
        const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
        const rolesCount = guild.roles.cache.size;

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📊 ${guild.name} Bilgileri`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '👑 Sunucu Sahibi', value: `${owner.user.tag} (${owner.id})`, inline: false },
                { name: '🆔 Sunucu ID', value: `\`${guild.id}\``, inline: true },
                { name: '👥 Toplam Üye', value: `\`${totalMembers}\``, inline: true },
                { name: '📅 Kuruluş Tarihi', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '💬 Yazı Kanalları', value: `\`${textChannels}\``, inline: true },
                { name: '🔊 Ses Kanalları', value: `\`${voiceChannels}\``, inline: true },
                { name: '🎭 Rol Sayısı', value: `\`${rolesCount}\``, inline: true }
            )
            .setFooter({ text: `${interaction.user.tag} tarafından istendi.`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
