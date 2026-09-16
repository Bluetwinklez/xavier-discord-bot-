const { SlashCommandBuilder } = require('discord.js');
const { getQueue, requireSameVoiceChannel, shuffleQueue } = require('../../utils/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('karistir')
        .setDescription('Müzik kuyruğundaki şarkıların sırasını karıştırır.'),
    async execute(interaction) {
        const queue = getQueue(interaction.guildId);
        const check = requireSameVoiceChannel(interaction, queue);
        if (!check.ok) return interaction.reply({ content: check.reply, ephemeral: true });

        const count = shuffleQueue(interaction.guildId);

        if (!count) {
            return interaction.reply({ content: '❌ Karıştırılacak yeterli şarkı yok (en az 3 şarkı gerekir)!', ephemeral: true });
        }

        await interaction.reply(`🔀 Kuyruktaki **${count} şarkı** karıştırıldı.`);
    },
};
