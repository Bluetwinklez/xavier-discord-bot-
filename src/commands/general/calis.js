const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { work } = require('../../utils/economyManager');

const WORK_MESSAGES = [
    'Kod yazarak',
    'Kahve dağıtarak',
    'Sunucuyu yöneterek',
    'Balık tutarak',
    'Araba yıkayarak',
    'Ders vererek',
    'Teslimat yaparak'
];

function formatDuration(ms) {
    const minutes = Math.floor(ms / (60 * 1000));
    return `${minutes} dakika`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('calis')
        .setDescription('Çalışarak para kazanın (1 saatte bir).'),
    async execute(interaction) {
        const result = work(interaction.guildId, interaction.user.id);

        if (!result.ok) {
            return interaction.reply({
                content: `⏳ Yorgunsun, biraz dinlen! Tekrar çalışmak için **${formatDuration(result.remainingMs)}** beklemelisin.`,
                ephemeral: true
            });
        }

        const activity = WORK_MESSAGES[Math.floor(Math.random() * WORK_MESSAGES.length)];
        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setDescription(`🛠️ ${activity} **+${result.amount}** 🪙 kazandın!\n💰 Yeni bakiyen: **${result.balance}** 🪙`);

        await interaction.reply({ embeds: [embed] });
    },
};
