const { SlashCommandBuilder } = require('discord.js');
const { getQueue, requireSameVoiceChannel } = require('../../utils/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('durdur')
        .setDescription('Çalmakta olan müziği duraklatır.'),
    async execute(interaction) {
        const queue = getQueue(interaction.guildId);

        if (!queue || !queue.player) {
            return interaction.reply({ content: '❌ Şu anda çalan bir şarkı yok!', ephemeral: true });
        }

        const check = requireSameVoiceChannel(interaction, queue);
        if (!check.ok) return interaction.reply({ content: check.reply, ephemeral: true });

        queue.player.pause();
        await interaction.reply('⏸️ Müzik duraklatıldı. `/devam` komutu ile tekrar başlatabilirsiniz.');
    },
};
