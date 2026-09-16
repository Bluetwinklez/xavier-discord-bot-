const { SlashCommandBuilder } = require('discord.js');
const { getQueue, requireSameVoiceChannel } = require('../../utils/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('devam')
        .setDescription('Duraklatılmış olan müziği sürdürür.'),
    async execute(interaction) {
        const queue = getQueue(interaction.guildId);

        if (!queue || !queue.player) {
            return interaction.reply({ content: '❌ Şu anda duraklatılmış bir şarkı yok!', ephemeral: true });
        }

        const check = requireSameVoiceChannel(interaction, queue);
        if (!check.ok) return interaction.reply({ content: check.reply, ephemeral: true });

        queue.player.unpause();
        await interaction.reply('▶️ Müzik çalmaya devam ediyor!');
    },
};
