const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getRemindersForUser, shortId, findReminderByShortId, removeReminder } = require('../../utils/reminderManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hatirlatma-yonet')
        .setDescription('Kurduğunuz hatırlatıcıları listeler veya iptal eder.')
        .addSubcommand(sub =>
            sub.setName('listele')
                .setDescription('Bu sunucudaki bekleyen hatırlatıcılarınızı listeler')
        )
        .addSubcommand(sub =>
            sub.setName('iptal')
                .setDescription('Kurduğunuz bir hatırlatıcıyı iptal eder')
                .addStringOption(opt =>
                    opt.setName('id')
                        .setDescription('/hatirlatma-yonet listele komutundaki kısa kod')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'listele') {
            const reminders = getRemindersForUser(interaction.guildId, interaction.user.id);

            if (reminders.length === 0) {
                return interaction.reply({ content: '📭 Bekleyen bir hatırlatıcınız yok.', ephemeral: true });
            }

            const lines = reminders.map(r =>
                `\`${shortId(r.id)}\` — <t:${Math.floor(r.triggerAt / 1000)}:R> — **${r.message}**`
            );

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('⏰ Bekleyen Hatırlatıcıların')
                .setDescription(lines.join('\n'))
                .setFooter({ text: 'İptal etmek için: /hatirlatma-yonet iptal id:<kod>' });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // sub === 'iptal'
        const ref = interaction.options.getString('id').trim();
        const reminder = findReminderByShortId(interaction.guildId, interaction.user.id, ref);

        if (!reminder) {
            return interaction.reply({
                content: '❌ Bu kodla size ait bekleyen bir hatırlatıcı bulamadım. `/hatirlatma-yonet listele` ile kontrol edebilirsiniz.',
                ephemeral: true
            });
        }

        removeReminder(reminder.id);
        await interaction.reply({ content: `✅ İptal edildi: **${reminder.message}**`, ephemeral: true });
    },
};
