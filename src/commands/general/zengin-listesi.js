const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../../utils/economyManager');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('zengin-listesi')
        .setDescription('Sunucudaki en zengin üyeleri listeler.'),
    async execute(interaction) {
        const top = getLeaderboard(interaction.guildId, 10);

        if (top.length === 0) {
            return interaction.reply({ content: '❌ Henüz kimsenin bakiyesi yok!', ephemeral: true });
        }

        const lines = top.map(entry =>
            `${MEDALS[entry.rank - 1] || `\`${entry.rank}.\``} <@${entry.userId}> — **${entry.balance}** 🪙`
        );

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle(`💰 ${interaction.guild.name} Zenginlik Sıralaması`)
            .setDescription(lines.join('\n'))
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
