const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { playRadio } = require('../../utils/radioCatalog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pomodoro')
        .setDescription('Yazılımcılar ve öğrenciler için odaklanma ve mola seansı başlatır.')
        .addIntegerOption(opt =>
            opt.setName('calisma_dk')
                .setDescription('Çalışma süresi (dakika, varsayılan 25)')
                .setMinValue(5)
                .setMaxValue(120)
                .setRequired(false)
        )
        .addIntegerOption(opt =>
            opt.setName('mola_dk')
                .setDescription('Mola süresi (dakika, varsayılan 5)')
                .setMinValue(1)
                .setMaxValue(30)
                .setRequired(false)
        )
        .addBooleanOption(opt =>
            opt.setName('lofi_muzik')
                .setDescription('Ses kanalındaysanız arka planda Lo-Fi müzik çalsın mı?')
                .setRequired(false)
        ),

    async execute(interaction) {
        const workMin = interaction.options.getInteger('calisma_dk') || 25;
        const breakMin = interaction.options.getInteger('mola_dk') || 5;
        const playMusic = interaction.options.getBoolean('lofi_muzik') ?? true;

        const voiceChannel = interaction.member.voice?.channel;
        let musicStarted = false;

        if (voiceChannel && playMusic) {
            try {
                await playRadio(voiceChannel, 'lofi');
                musicStarted = true;
            } catch (err) {}
        }

        const endTime = Math.floor((Date.now() + workMin * 60 * 1000) / 1000);

        const startEmbed = new EmbedBuilder()
            .setColor(0xE67E22)
            .setTitle('🍅 Pomodoro Odaklanma Seansı Başladı!')
            .setDescription(`
${interaction.user}, odaklanma süren başladı! Bildirimleri sessize al ve işine odaklan.

⏱️ **Çalışma Süresi:** ${workMin} dakika
☕ **Sonraki Mola:** ${breakMin} dakika
⌛ **Bitiş Zamanı:** <t:${endTime}:T> (<t:${endTime}:R>)
${musicStarted ? '🎧 **Ses Kanalında:** *Lofi Chill Radyo yayını başlatıldı.*' : ''}
            `)
            .setFooter({ text: 'Pomodoro Tekniği: 25dk Odaklan + 5dk Mola' })
            .setTimestamp();

        await interaction.reply({ embeds: [startEmbed] });

        // Çalışma süresi bittiğinde mola bildirimi
        setTimeout(async () => {
            const breakEnd = Math.floor((Date.now() + breakMin * 60 * 1000) / 1000);

            const breakEmbed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('☕ Mola Vakti Geldi!')
                .setDescription(`
${interaction.user}, tebrikler! **${workMin} dakikalık** odaklanma seansını tamamladın.
Şimdi kahveni al, biraz gerin ve gözlerini dinlendir.

⌛ **Mola Bitiş:** <t:${breakEnd}:T> (<t:${breakEnd}:R>)
                `)
                .setTimestamp();

            await interaction.channel.send({ content: `${interaction.user}`, embeds: [breakEmbed] }).catch(() => {});

            // Mola süresi bittiğinde bildirim
            setTimeout(async () => {
                const completeEmbed = new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setTitle('🔔 Mola Bitti!')
                    .setDescription(`${interaction.user}, **${breakMin} dakikalık** mola sona erdi. Yeni bir seans başlatmak için tekrar \`/pomodoro\` yazabilirsin!`)
                    .setTimestamp();

                await interaction.channel.send({ content: `${interaction.user}`, embeds: [completeEmbed] }).catch(() => {});
            }, breakMin * 60 * 1000);

        }, workMin * 60 * 1000);
    },
};
