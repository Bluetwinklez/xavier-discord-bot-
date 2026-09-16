const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kur')
        .setDescription('Döviz kuru çevirir. (Kaynak: frankfurter.app, API anahtarı gerekmez)')
        .addNumberOption(option =>
            option.setName('miktar')
                .setDescription('Çevrilecek miktar')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('kaynak')
                .setDescription('Kaynak para birimi (Örn: USD, EUR, TRY)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('hedef')
                .setDescription('Hedef para birimi (Örn: TRY, USD, EUR)')
                .setRequired(true)
        ),
    async execute(interaction) {
        const amount = interaction.options.getNumber('miktar');
        const from = interaction.options.getString('kaynak').toUpperCase();
        const to = interaction.options.getString('hedef').toUpperCase();

        await interaction.deferReply();

        try {
            const res = await fetch(`https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`);

            if (!res.ok) {
                return interaction.editReply(`❌ **${from} → ${to}** çevrimi yapılamadı. Para birimi kodlarını kontrol edin (Örn: USD, EUR, TRY, GBP).`);
            }

            const data = await res.json();
            const result = data.rates?.[to];

            if (result === undefined) {
                return interaction.editReply(`❌ **${to}** için kur bilgisi bulunamadı.`);
            }

            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('💱 Döviz Kuru Çevirici')
                .setDescription(`**${amount} ${from}** = **${result.toFixed(2)} ${to}**`)
                .setFooter({ text: `Kaynak: frankfurter.app (ECB verisi) · Tarih: ${data.date}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Kur çevirme hatası:', error);
            await interaction.editReply('❌ Kur bilgisi alınırken bir hata oluştu.');
        }
    },
};
