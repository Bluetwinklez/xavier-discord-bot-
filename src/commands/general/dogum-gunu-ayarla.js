const { SlashCommandBuilder } = require('discord.js');
const { setBirthday } = require('../../utils/birthdayManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dogum-gunu-ayarla')
        .setDescription('Kendi doğum gününüzü (ay/gün) kaydeder.')
        .addIntegerOption(option =>
            option.setName('ay')
                .setDescription('Doğum ayınız (1-12)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(12)
        )
        .addIntegerOption(option =>
            option.setName('gun')
                .setDescription('Doğum gününüz (1-31)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(31)
        ),
    async execute(interaction) {
        const month = interaction.options.getInteger('ay');
        const day = interaction.options.getInteger('gun');

        const daysInMonth = new Date(2024, month, 0).getDate(); // 2024 artık yıl, 29 Şubat'a izin verir
        if (day > daysInMonth) {
            return interaction.reply({ content: `❌ ${month}. ay için geçersiz gün.`, ephemeral: true });
        }

        setBirthday(interaction.guildId, interaction.user.id, month, day);

        await interaction.reply({ content: `🎂 Doğum gününüz **${day}/${month}** olarak kaydedildi! O gün geldiğinde sizi kutlayacağım.`, ephemeral: true });
    },
};
