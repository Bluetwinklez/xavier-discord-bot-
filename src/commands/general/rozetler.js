const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getAllBadges } = require('../../utils/badgeManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rozetler')
        .setDescription('Kullanıcının kazandığı sunucu rozetlerini ve başarımlarını gösterir.')
        .addUserOption(opt =>
            opt.setName('kullanici')
                .setDescription('Rozetlerine bakılacak kullanıcı (boş bırakırsanız kendiniz)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('kullanici') || interaction.user;
        const targetMember = interaction.guild.members.cache.get(targetUser.id) || await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        const daysInServer = targetMember ? Math.floor((Date.now() - targetMember.joinedTimestamp) / (1000 * 60 * 60 * 24)) : 0;
        const allBadges = getAllBadges(interaction.guildId, targetUser.id, daysInServer);

        const unlockedCount = allBadges.filter(b => b.unlocked).length;

        const badgeLines = allBadges.map(b => {
            const icon = b.unlocked ? '✨' : '🔒';
            const status = b.unlocked ? '**[KAZANILDI]**' : '*(Kilitli)*';
            return `${icon} **${b.name}** ${status}\n┗ *${b.desc}*`;
        });

        const embed = new EmbedBuilder()
            .setColor(unlockedCount >= 3 ? 0xF1C40F : 0x5865F2)
            .setTitle(`🏆 ${targetUser.username} Sunucu Rozetleri`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setDescription(`**Başarım Durumu:** ${unlockedCount} / ${allBadges.length} Rozet Açıldı\n\n` + badgeLines.join('\n\n'))
            .setFooter({ text: `${interaction.guild.name} Başarım & Rozet Sistemi` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
