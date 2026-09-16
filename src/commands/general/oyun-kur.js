const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { setSettings } = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oyun-kur')
        .setDescription('Kanal içi mini eğlence oyunlarını (Kelime Türetmece / Sayı Saymaca) kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub =>
            sub.setName('kelime')
                .setDescription('Kelime türetmece kanalı oluşturur ve ayarlar.')
        )
        .addSubcommand(sub =>
            sub.setName('sayi')
                .setDescription('Sayı saymaca kanalı oluşturur ve ayarlar.')
        ),

    async execute(interaction) {
        await interaction.deferReply();
        const sub = interaction.options.getSubcommand();

        if (sub === 'kelime') {
            let channel = interaction.guild.channels.cache.find(
                c => c.type === ChannelType.GuildText && c.name.includes('kelime-turetmece')
            );

            if (!channel) {
                channel = await interaction.guild.channels.create({
                    name: '🔤┃kelime-turetmece',
                    type: ChannelType.GuildText,
                    topic: '🔤 Kelime Türetmece: Bir önceki kelimenin son harfiyle başlayan yeni kelime türetin! Her kelime +5 coin kazandırır.'
                });
            }

            setSettings(interaction.guildId, { wordGameChannelId: channel.id });

            const infoEmbed = new EmbedBuilder()
                .setColor(0x00FF88)
                .setTitle('🔤 Kelime Türetmece Oyunu Başladı!')
                .setDescription('**Kurallar:**\n' +
                    '1. Bir önceki kelimenin **son harfiyle** başlayan yeni bir Türkçe kelime yazın.\n' +
                    '2. Üst üste iki kez kelime yazamazsınız, başkasının yazmasını bekleyin.\n' +
                    '3. Aynı kelimeyi tekrar yazmak yasaktır.\n' +
                    '4. Her doğru kelime size **+5 💰** kazandırır!\n\n' +
                    '👉 **İlk Kelime:** `elma` (A harfiyle başlayan bir kelime yazın!)')
                .setTimestamp();

            await channel.send({ embeds: [infoEmbed] });
            return interaction.editReply(`✅ Kelime türetmece kanalı başarıyla kuruldu: ${channel}`);
        }

        if (sub === 'sayi') {
            let channel = interaction.guild.channels.cache.find(
                c => c.type === ChannelType.GuildText && c.name.includes('sayi-saymaca')
            );

            if (!channel) {
                channel = await interaction.guild.channels.create({
                    name: '🔢┃sayi-saymaca',
                    type: ChannelType.GuildText,
                    topic: '🔢 Sayı Saymaca: 1, 2, 3... ardışık sayın! Sayacı bozan sıfırlar. Her 25 sayıda bir +50 coin!'
                });
            }

            setSettings(interaction.guildId, { countingChannelId: channel.id });

            const infoEmbed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('🔢 Sayı Saymaca Oyunu Başladı!')
                .setDescription('**Kurallar:**\n' +
                    '1. Sıradaki sayıyı yazın (1, 2, 3...)\n' +
                    '2. Üst üste iki kez sayı yazamazsınız.\n' +
                    '3. Yanlış sayı yazılırsa sayaç **sıfırlanır**!\n' +
                    '4. Her 25 sayıda bir **+50 💰** ödül verilir.\n\n' +
                    '👉 **İlk Sayı:** `1` (Hemen yazıp başlayabilirsiniz!)')
                .setTimestamp();

            await channel.send({ embeds: [infoEmbed] });
            return interaction.editReply(`✅ Sayı saymaca kanalı başarıyla kuruldu: ${channel}`);
        }
    },
};
