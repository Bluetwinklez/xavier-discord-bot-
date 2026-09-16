const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getQueue } = require('../../utils/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kuyruk')
        .setDescription('Şu anki müzik kuyruğunu listeler.'),
    async execute(interaction) {
        const queue = getQueue(interaction.guildId);

        if (!queue || !queue.songs || queue.songs.length === 0) {
            return interaction.reply({ content: '❌ Şu an kuyrukta hiç parça bulunmuyor!', ephemeral: true });
        }

        const songList = queue.songs.slice(0, 10).map((s, index) => {
            if (index === 0) {
                return `▶️ **Şu an:** [${s.title}](${s.url}) (${s.duration}) - ${s.requester}`;
            }
            return `\`${index}.\` [${s.title}](${s.url}) (${s.duration}) - ${s.requester}`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🎶 ${interaction.guild.name} Müzik Kuyruğu`)
            .setDescription(songList)
            .setFooter({ text: `Kuyrukta toplam ${queue.songs.length} parça var.` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
