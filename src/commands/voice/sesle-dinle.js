const { SlashCommandBuilder } = require('discord.js');
const { startListening } = require('../../utils/voiceListener');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sesle-dinle')
        .setDescription('Botun senin sesini dinleyip sesli komutlarını yerine getirmesini başlatır (Fish Audio gerekir).'),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ Sesle komut vermek için bir ses kanalında olmalısınız!', ephemeral: true });
        }

        await interaction.deferReply();
        const result = await startListening(voiceChannel, interaction.channel, interaction.member, interaction.guild, interaction.client);
        await interaction.editReply(result);
    },
};
