const { SlashCommandBuilder } = require('discord.js');
const { parseDuration, addReminder } = require('../../utils/reminderManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hatirlat')
        .setDescription('Belirli bir süre sonra size hatırlatma gönderir.')
        .addStringOption(opt => opt.setName('sure').setDescription('Örn: 10dk, 2saat, 1gun').setRequired(true))
        .addStringOption(opt => opt.setName('mesaj').setDescription('Hatırlatma mesajı').setRequired(true)),
    async execute(interaction) {
        const durationStr = interaction.options.getString('sure');
        const message = interaction.options.getString('mesaj');

        const ms = parseDuration(durationStr);
        if (!ms) {
            return interaction.reply({ content: '❌ Süreyi anlayamadım. Örnekler: `10dk`, `2saat`, `1gun`, `30sn`', ephemeral: true });
        }
        if (ms > 30 * 24 * 60 * 60 * 1000) {
            return interaction.reply({ content: '❌ En fazla 30 gün sonrası için hatırlatıcı kurabilirsiniz.', ephemeral: true });
        }

        const triggerAt = Date.now() + ms;
        addReminder(interaction.guildId, interaction.channelId, interaction.user.id, message, triggerAt);

        await interaction.reply(`⏰ Tamamdır! <t:${Math.floor(triggerAt / 1000)}:R> hatırlatacağım: **${message}**`);
    },
};
