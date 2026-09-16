const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getSettings } = require('../../utils/database');
const { readJSON, writeJSON } = require('../../utils/fileStore');
const { checkCooldown } = require('../../utils/cooldown');

const FILE_NAME = 'confessions.json';
const CONFESSION_COOLDOWN_MS = 5 * 60 * 1000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('itiraf-et')
        .setDescription('Kimliğin gizli kalacak şekilde itiraf kanalına anonim itiraf gönderir.')
        .addStringOption(opt =>
            opt.setName('mesaj')
                .setDescription('İtiraf etmek istediğiniz metin')
                .setMaxLength(4000)
                .setRequired(true)
        ),

    async execute(interaction) {
        const settings = getSettings(interaction.guildId);

        if (!settings.confessionChannelId) {
            return interaction.reply({
                content: '⚠️ Sunucuda henüz bir itiraf kanalı kurulmamış! Yöneticiler `/itiraf-kanali-kur` ile kurabilir.',
                ephemeral: true
            });
        }

        const channel = interaction.guild.channels.cache.get(settings.confessionChannelId);
        if (!channel) {
            return interaction.reply({
                content: '⚠️ İtiraf kanalı bulunamadı veya silinmiş! Lütfen yöneticilere bildirin.',
                ephemeral: true
            });
        }

        const cooldownMs = checkCooldown('itiraf', interaction.user.id, CONFESSION_COOLDOWN_MS);
        if (cooldownMs > 0) {
            return interaction.reply({
                content: `⏳ Çok sık itiraf gönderiyorsun, ${Math.ceil(cooldownMs / 60000)} dakika bekle.`,
                ephemeral: true
            });
        }

        const text = interaction.options.getString('mesaj');

        try {
            // Sayaç artır (embed oluşturma da try içine alındı — 4000+ karakterlik metin
            // EmbedBuilder.setDescription'da doğrulama hatası fırlatabiliyordu, artık yakalanıyor)
            const counters = readJSON(FILE_NAME, {});
            if (!counters[interaction.guildId]) counters[interaction.guildId] = 0;
            counters[interaction.guildId] += 1;
            const count = counters[interaction.guildId];
            writeJSON(FILE_NAME, counters);

            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle(`🎭 Anonim İtiraf #${count}`)
                .setDescription(`*"${text}"*`)
                .setFooter({ text: 'Gizli Gönderici • /itiraf-et ile sen de itiraf et' })
                .setTimestamp();

            const msg = await channel.send({ embeds: [embed] });
            await msg.react('❤️').catch(() => {});
            await msg.react('😮').catch(() => {});
            await msg.react('😂').catch(() => {});
            await msg.react('💀').catch(() => {});

            await interaction.reply({
                content: `✅ İtirafın başarıyla anonim olarak ${channel} kanalına gönderildi! (#${count})`,
                ephemeral: true
            });
        } catch (err) {
            console.error('itiraf-et hatası:', err);
            await interaction.reply({ content: '❌ İtiraf gönderilirken bir sorun oluştu.', ephemeral: true });
        }
    },
};
