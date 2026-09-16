const { SlashCommandBuilder } = require('discord.js');
const { getQueue, requireSameVoiceChannel, setVolume } = require('../../utils/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ses-seviyesi')
        .setDescription('Çalan müziğin ses seviyesini ayarlar (0-200).')
        .addIntegerOption(option =>
            option.setName('seviye')
                .setDescription('Ses seviyesi yüzdesi (100 = normal)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(200)
        ),
    async execute(interaction) {
        const queue = getQueue(interaction.guildId);
        const check = requireSameVoiceChannel(interaction, queue);
        if (!check.ok) return interaction.reply({ content: check.reply, ephemeral: true });

        const level = interaction.options.getInteger('seviye');
        const result = setVolume(interaction.guildId, level);

        if (result === null) {
            return interaction.reply({ content: '❌ Şu anda çalan bir müzik yok!', ephemeral: true });
        }

        await interaction.reply(`🔊 Ses seviyesi **%${result}** olarak ayarlandı.`);
    },
};
