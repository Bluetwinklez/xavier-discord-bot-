const { SlashCommandBuilder } = require('discord.js');
const { getQueue, requireSameVoiceChannel, toggleLoop } = require('../../utils/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tekrar')
        .setDescription('Çalan şarkının tekrar (loop) modunu açar veya kapatır.'),
    async execute(interaction) {
        const queue = getQueue(interaction.guildId);
        const check = requireSameVoiceChannel(interaction, queue);
        if (!check.ok) return interaction.reply({ content: check.reply, ephemeral: true });

        const loop = toggleLoop(interaction.guildId);

        if (loop === null) {
            return interaction.reply({ content: '❌ Şu anda çalan bir müzik yok!', ephemeral: true });
        }

        await interaction.reply(loop ? '🔁 Şarkı tekrar modu **açıldı**.' : '➡️ Şarkı tekrar modu **kapatıldı**.');
    },
};
