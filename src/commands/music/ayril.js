const { SlashCommandBuilder } = require('discord.js');
const { getQueue, queues, requireSameVoiceChannel } = require('../../utils/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ayril')
        .setDescription('Botu ses kanalından ayırır ve kuyruğu temizler.'),
    async execute(interaction) {
        const queue = getQueue(interaction.guildId);

        if (!queue) {
            return interaction.reply({ content: '❌ Bot şu anda bir ses kanalında değil!', ephemeral: true });
        }

        const check = requireSameVoiceChannel(interaction, queue);
        if (!check.ok) return interaction.reply({ content: check.reply, ephemeral: true });

        if (queue.connection) {
            queue.connection.destroy();
        }
        queues.delete(interaction.guildId);

        await interaction.reply('👋 Ses kanalından ayrıldım ve çalma listesi sıfırlandı.');
    },
};
