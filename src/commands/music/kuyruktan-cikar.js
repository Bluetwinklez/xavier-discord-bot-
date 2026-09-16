const { SlashCommandBuilder } = require('discord.js');
const { getQueue, requireSameVoiceChannel, removeFromQueue } = require('../../utils/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kuyruktan-cikar')
        .setDescription('Kuyruktan belirli bir sıradaki şarkıyı çıkarır.')
        .addIntegerOption(opt =>
            opt.setName('sira')
                .setDescription('/kuyruk komutundaki sıra numarası (şu an çalan hariç)')
                .setRequired(true)
                .setMinValue(1)
        ),
    async execute(interaction) {
        const queue = getQueue(interaction.guildId);
        const check = requireSameVoiceChannel(interaction, queue);
        if (!check.ok) return interaction.reply({ content: check.reply, ephemeral: true });

        const index = interaction.options.getInteger('sira');
        const removed = removeFromQueue(interaction.guildId, index);

        if (!removed) {
            return interaction.reply({ content: '❌ Geçersiz sıra numarası veya kuyrukta o kadar şarkı yok!', ephemeral: true });
        }

        await interaction.reply(`🗑️ Kuyruktan çıkarıldı: **${removed.title}**`);
    },
};
