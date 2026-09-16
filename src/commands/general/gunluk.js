const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { claimDaily } = require('../../utils/economyManager');

function formatDuration(ms) {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours} saat ${minutes} dakika`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gunluk')
        .setDescription('Günlük ödülünüzü toplayın (24 saatte bir).'),
    async execute(interaction) {
        const result = claimDaily(interaction.guildId, interaction.user.id);

        if (!result.ok) {
            return interaction.reply({
                content: `⏳ Günlük ödülünüzü zaten aldınız! Tekrar almak için **${formatDuration(result.remainingMs)}** beklemelisiniz.`,
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setDescription(`🎁 Günlük ödülün: **+${result.amount}** 🪙\n💰 Yeni bakiyen: **${result.balance}** 🪙`);

        await interaction.reply({ embeds: [embed] });
    },
};
