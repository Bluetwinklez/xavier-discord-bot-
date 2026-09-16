const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { RADIO_STATIONS, playRadio } = require('../../utils/radioCatalog');
const { checkCooldown } = require('../../utils/cooldown');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('radyo')
        .setDescription('Ses kanalında canlı radyo veya 7/24 kesintisiz Lofi yayını başlatır.')
        .addStringOption(option =>
            option.setName('istasyon')
                .setDescription('Dinlemek istediğiniz radyo istasyonu')
                .setRequired(true)
                .addChoices(
                    { name: '📻 PowerTürk (Pop & Hit)', value: 'powerturk' },
                    { name: '📻 Radyo Fenomen (Yabancı Hit)', value: 'fenomen' },
                    { name: '📻 SlowTürk (Akustik & Slow)', value: 'slowturk' },
                    { name: '📻 Best FM (Konuşan Radyo)', value: 'bestfm' },
                    { name: '☕ 7/24 Lofi & Chill Beats (Ders/Kod)', value: 'lofi' }
                )
        ),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice?.channel;

        if (!voiceChannel) {
            return interaction.reply({
                content: '❌ Radyo dinleyebilmek için bir ses kanalında olmalısınız!',
                ephemeral: true
            });
        }

        const cooldownMs = checkCooldown('radyo', interaction.user.id, 3000);
        if (cooldownMs > 0) {
            return interaction.reply({ content: `⏳ Çok hızlı istasyon değiştiriyorsun, ${Math.ceil(cooldownMs / 1000)} saniye bekle.`, ephemeral: true });
        }

        const stationKey = interaction.options.getString('istasyon');

        await interaction.deferReply();

        try {
            const station = await playRadio(voiceChannel, stationKey);

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`📻 ${station.name} Canlı Yayını Başladı!`)
                .setDescription(station.description)
                .addFields(
                    { name: '🔊 Ses Kanalı', value: `${voiceChannel.name}`, inline: true },
                    { name: '🎧 Başlatan', value: `${interaction.user}`, inline: true }
                )
                .setFooter({ text: 'Radyoyu durdurmak için /sesten-ayril yazabilirsiniz.' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Radyo çalma hatası:', error);
            await interaction.editReply({ content: `❌ Radyo başlatılamadı: ${error.message}` });
        }
    },
};
