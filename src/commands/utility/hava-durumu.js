const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hava-durumu')
        .setDescription('Belirtilen şehrin güncel hava durumunu gösterir. (Kaynak: wttr.in, API anahtarı gerekmez)')
        .addStringOption(option =>
            option.setName('sehir')
                .setDescription('Hava durumu sorgulanacak şehir (Örn: Istanbul, Ankara, Izmir)')
                .setRequired(true)
        ),
    async execute(interaction) {
        const city = interaction.options.getString('sehir');
        await interaction.deferReply();

        try {
            const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, {
                headers: { 'User-Agent': 'curl/8.0' }
            });

            if (!res.ok) {
                return interaction.editReply(`❌ **"${city}"** için hava durumu bulunamadı.`);
            }

            const data = await res.json();
            const current = data.current_condition?.[0];
            const today = data.weather?.[0];
            const areaName = data.nearest_area?.[0]?.areaName?.[0]?.value || city;

            if (!current) {
                return interaction.editReply(`❌ **"${city}"** için hava durumu verisi alınamadı.`);
            }

            const embed = new EmbedBuilder()
                .setColor(0x00AEEF)
                .setTitle(`🌤️ ${areaName} Hava Durumu`)
                .addFields(
                    { name: '🌡️ Sıcaklık', value: `${current.temp_C}°C (Hissedilen: ${current.FeelsLikeC}°C)`, inline: true },
                    { name: '💧 Nem', value: `%${current.humidity}`, inline: true },
                    { name: '💨 Rüzgar', value: `${current.windspeedKmph} km/s`, inline: true },
                    { name: '☁️ Durum', value: current.lang_tr?.[0]?.value || current.weatherDesc?.[0]?.value || 'Bilinmiyor', inline: true },
                    { name: '📈 Bugün En Yüksek/Düşük', value: today ? `${today.maxtempC}°C / ${today.mintempC}°C` : 'Bilinmiyor', inline: true }
                )
                .setFooter({ text: 'Kaynak: wttr.in' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Hava durumu hatası:', error);
            await interaction.editReply('❌ Hava durumu alınırken bir hata oluştu, lütfen şehir adını kontrol edip tekrar deneyin.');
        }
    },
};
