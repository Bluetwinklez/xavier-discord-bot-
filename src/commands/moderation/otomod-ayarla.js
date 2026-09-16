const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getAutomodSettings, setAutomodSettings } = require('../../utils/automod');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('otomod-ayarla')
        .setDescription('Otomatik moderasyon sistemini (yasaklı kelime, davet linki, spam) yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('durum')
                .setDescription('Otomatik moderasyonu açar veya kapatır')
                .addBooleanOption(opt => opt.setName('aktif').setDescription('true = aç, false = kapat').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('kelime-ekle')
                .setDescription('Yasaklı kelime listesine ekler')
                .addStringOption(opt => opt.setName('kelime').setDescription('Eklenecek kelime').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('kelime-sil')
                .setDescription('Yasaklı kelime listesinden çıkarır')
                .addStringOption(opt => opt.setName('kelime').setDescription('Çıkarılacak kelime').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('kelime-listele')
                .setDescription('Yasaklı kelime listesini gösterir')
        )
        .addSubcommand(sub =>
            sub.setName('davet-linki')
                .setDescription('Discord davet linki paylaşımını engeller/serbest bırakır')
                .addBooleanOption(opt => opt.setName('engelle').setDescription('true = engelle, false = serbest bırak').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('spam-esigi')
                .setDescription('Spam algılama eşiğini ayarlar')
                .addIntegerOption(opt => opt.setName('mesaj-sayisi').setDescription('Eşik süresi içinde izin verilen maksimum mesaj').setRequired(true).setMinValue(2).setMaxValue(30))
                .addIntegerOption(opt => opt.setName('saniye').setDescription('Eşik süresi (saniye)').setRequired(true).setMinValue(2).setMaxValue(60))
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.Administrator)) return;

        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (sub === 'durum') {
            const aktif = interaction.options.getBoolean('aktif');
            setAutomodSettings(guildId, { enabled: aktif });
            return interaction.reply(aktif ? '🛡️ Otomatik moderasyon **açıldı**.' : '⏸️ Otomatik moderasyon **kapatıldı**.');
        }

        if (sub === 'kelime-ekle') {
            const word = interaction.options.getString('kelime').toLowerCase().trim();
            const settings = getAutomodSettings(guildId);
            const words = new Set(settings.bannedWords || []);
            words.add(word);
            setAutomodSettings(guildId, { bannedWords: [...words] });
            return interaction.reply(`✅ **"${word}"** yasaklı kelime listesine eklendi. (Toplam: ${words.size})`);
        }

        if (sub === 'kelime-sil') {
            const word = interaction.options.getString('kelime').toLowerCase().trim();
            const settings = getAutomodSettings(guildId);
            const words = (settings.bannedWords || []).filter(w => w !== word);
            setAutomodSettings(guildId, { bannedWords: words });
            return interaction.reply(`🗑️ **"${word}"** yasaklı kelime listesinden çıkarıldı.`);
        }

        if (sub === 'kelime-listele') {
            const settings = getAutomodSettings(guildId);
            const words = settings.bannedWords || [];
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🚫 Yasaklı Kelime Listesi')
                .setDescription(words.length ? words.map(w => `\`${w}\``).join(', ') : '*Liste boş.*')
                .setTimestamp();
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'davet-linki') {
            const engelle = interaction.options.getBoolean('engelle');
            setAutomodSettings(guildId, { blockInvites: engelle });
            return interaction.reply(engelle ? '🔗 Discord davet linki paylaşımı **engellendi**.' : '🔗 Discord davet linki paylaşımı **serbest bırakıldı**.');
        }

        if (sub === 'spam-esigi') {
            const count = interaction.options.getInteger('mesaj-sayisi');
            const seconds = interaction.options.getInteger('saniye');
            setAutomodSettings(guildId, { spamCount: count, spamSeconds: seconds });
            return interaction.reply(`⏱️ Spam eşiği **${seconds} saniyede ${count} mesaj** olarak ayarlandı.`);
        }
    },
};
