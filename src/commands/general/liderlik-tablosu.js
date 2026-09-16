const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../../utils/levelSystem');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('liderlik-tablosu')
        .setDescription('Sunucudaki en yüksek seviyeli üyeleri listeler.'),
    async execute(interaction) {
        const top = getLeaderboard(interaction.guildId, 10);

        if (top.length === 0) {
            return interaction.reply({ content: '📊 Henüz kimse XP kazanmamış. Sohbet ederek seviye kazanmaya başla!', ephemeral: true });
        }

        const lines = await Promise.all(top.map(async (entry) => {
            const member = await interaction.guild.members.fetch(entry.userId).catch(() => null);
            const name = member ? member.displayName : `Bilinmeyen Üye (${entry.userId})`;
            const medal = MEDALS[entry.rank - 1] || `\`#${entry.rank}\``;
            return `${medal} **${name}** — Seviye ${entry.level} (${entry.xp} XP)`;
        }));

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle(`🏆 ${interaction.guild.name} Liderlik Tablosu`)
            .setDescription(lines.join('\n'))
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
