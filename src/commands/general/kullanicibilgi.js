const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kullanicibilgi')
        .setDescription('Bir kullanıcının veya kendinizin profil bilgilerini gösterir.')
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Bilgisi gösterilecek kullanıcı (Boş bırakılırsa kendiniz)')
                .setRequired(false)
        ),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('kullanici') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        const embed = new EmbedBuilder()
            .setColor(0x00A8FF)
            .setTitle(`👤 ${targetUser.tag} Profili`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🆔 Kullanıcı ID', value: `\`${targetUser.id}\``, inline: true },
                { name: '🤖 Bot mu?', value: targetUser.bot ? 'Evet' : 'Hayır', inline: true },
                { name: '📅 Hesap Oluşturulma', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: false }
            );

        if (member) {
            const roles = member.roles.cache
                .filter(r => r.id !== interaction.guild.id)
                .map(r => r.toString())
                .join(', ') || 'Yok';

            embed.addFields(
                { name: '📥 Sunucuya Katılma', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: '🎭 Roller', value: roles.length > 1024 ? `${member.roles.cache.size} rol` : roles, inline: false }
            );
        }

        embed.setTimestamp();
        await interaction.reply({ embeds: [embed] });
    },
};
