const { SlashCommandBuilder } = require('discord.js');
const { stopListening } = require('../../utils/voiceListener');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sesle-dinle-durdur')
        .setDescription('Botun sesle komut dinlemesini durdurur.'),
    async execute(interaction) {
        const stopped = stopListening(interaction.guildId, interaction.user.id);
        await interaction.reply(stopped ? '🔇 Sesle komut dinleme durduruldu.' : '❌ Senin için aktif bir dinleme yok.');
    },
};
