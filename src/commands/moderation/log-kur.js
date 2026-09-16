const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { setSettings } = require('../../utils/database');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('log-kur')
        .setDescription('Denetim kaydı ve moderasyon olaylarının kaydedileceği log kanalını kurar ve ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Mevcut bir metin kanalı seçin (boş bırakırsanız otomatik yeni kanal açar ve ayarlar)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('kapat')
                .setDescription('Log sistemini tamamen kapatmak için Evet seçin')
                .setRequired(false)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.Administrator)) return;

        await interaction.deferReply();

        const kapat = interaction.options.getBoolean('kapat');
        if (kapat) {
            setSettings(interaction.guildId, { logChannelId: null });
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xED4245)
                        .setTitle('🔒 Log Sistemi Kapatıldı')
                        .setDescription('Log kanalı kaldırıldı, artık denetim kaydı olayları kaydedilmeyecek.')
                        .setTimestamp()
                ]
            });
        }

        let channel = interaction.options.getChannel('kanal');

        // Eğer kullanıcı bir kanal seçmediyse, otomatik olarak oluştur ve ayarla:
        if (!channel) {
            // Önce mevcut 'log' isimli bir kanal var mı kontrol et:
            channel = interaction.guild.channels.cache.find(
                c => c.type === ChannelType.GuildText && c.name.toLowerCase().includes('log')
            );

            if (!channel) {
                // Yoksa gizli yönetici kanalı olarak oluştur
                channel = await interaction.guild.channels.create({
                    name: '📋┃log-kayitlari',
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id, // @everyone
                            deny: [PermissionFlagsBits.ViewChannel] // Normal üyeler görmesin
                        },
                        {
                            id: interaction.client.user.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
                        }
                    ]
                });
            }
        }

        setSettings(interaction.guildId, { logChannelId: channel.id });

        // Kanala başlangıç bilgi mesajı gönder
        const infoEmbed = new EmbedBuilder()
            .setColor(0x00FF88)
            .setTitle('📋 Denetim Kaydı & Log Sistemi Aktif')
            .setDescription('Bu kanal, sunucu yöneticileri için otomatik denetim kaydı akış kanalı olarak ayarlandı.\n\n' +
                '**Kaydedilen Olaylar:**\n' +
                '• 🔨 Üye Yasaklama & Yasak Kaldırma (Ban / Unban)\n' +
                '• 👢 Üye Atma (Kick) & Susturma (Timeout)\n' +
                '• 🎭 Rol Ekleme, Çıkarma ve Güncellemeler\n' +
                '• 📁 Kanal ve Kategori Açma, Silme, İzin Düzenlemeleri\n' +
                '• 🔊 Ses Odası Taşıma ve Bağlantı Kesme\n' +
                '• 📨 Davet Linkleri, Emojiler ve Otomod İhlalleri')
            .setFooter({ text: 'Discord.js v14 Audit Log Engine' })
            .setTimestamp();

        channel.send({ embeds: [infoEmbed] }).catch(() => {});

        const replyEmbed = new EmbedBuilder()
            .setColor(0x00FF88)
            .setTitle('✅ Log Kanalı Kuruldu ve Ayarlandı')
            .setDescription(`Log kanalı başarıyla ${channel} olarak kuruldu ve bağlandı!\n\nArtık sunucudaki tüm **Denetim Kaydı (Audit Log)** olayları yapan yetkili, hedef ve detaylarıyla bu kanala anlık yazılacak.`)
            .setTimestamp();

        await interaction.editReply({ embeds: [replyEmbed] });
    },
};
