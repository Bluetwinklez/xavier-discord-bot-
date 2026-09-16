const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getRank, xpForLevel } = require('../../utils/levelSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seviye')
        .setDescription('Kendi veya başka bir kullanıcının seviye/XP bilgisini gösterir.')
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Seviyesi sorgulanacak kullanıcı (boş bırakılırsa kendiniz)')
                .setRequired(false)
        ),
    async execute(interaction) {
        const target = interaction.options.getUser('kullanici') || interaction.user;
        const rank = getRank(interaction.guildId, target.id);

        const barLength = 20;
        const filled = Math.round((rank.xp / rank.xpNeeded) * barLength);
        const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle(`📊 ${target.username} - Seviye Kartı`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🎖️ Seviye', value: `${rank.level}`, inline: true },
                { name: '🏆 Sıralama', value: `#${rank.rank} / ${rank.totalRanked}`, inline: true },
                { name: '⭐ XP', value: `${rank.xp} / ${rank.xpNeeded}`, inline: true },
                { name: '📈 İlerleme', value: `\`${bar}\`` }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
