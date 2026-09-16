const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anket')
        .setDescription('Bir anket oluşturur.')
        .addStringOption(opt => opt.setName('soru').setDescription('Anket sorusu').setRequired(true))
        .addStringOption(opt => opt.setName('secenekler').setDescription('Virgülle ayrılmış seçenekler (boş bırakılırsa Evet/Hayır anketi olur)').setRequired(false)),
    async execute(interaction) {
        const question = interaction.options.getString('soru');
        const rawOptions = interaction.options.getString('secenekler');

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📊 Anket')
            .setDescription(`**${question}**`)
            .setFooter({ text: `Anketi açan: ${interaction.user.tag}` })
            .setTimestamp();

        if (!rawOptions) {
            embed.addFields({ name: 'Oylama', value: '👍 Evet   /   👎 Hayır' });
            const message = await interaction.reply({ embeds: [embed], fetchReply: true });
            await message.react('👍');
            await message.react('👎');
            return;
        }

        const options = rawOptions.split(',').map(o => o.trim()).filter(Boolean).slice(0, 10);
        if (options.length < 2) {
            return interaction.reply({ content: '❌ En az 2 geçerli seçenek girmelisiniz (virgülle ayırın).', ephemeral: true });
        }

        const lines = options.map((opt, i) => `${NUMBER_EMOJIS[i]} ${opt}`);
        embed.addFields({ name: 'Seçenekler', value: lines.join('\n') });

        const message = await interaction.reply({ embeds: [embed], fetchReply: true });
        for (let i = 0; i < options.length; i++) {
            await message.react(NUMBER_EMOJIS[i]);
        }
    },
};
