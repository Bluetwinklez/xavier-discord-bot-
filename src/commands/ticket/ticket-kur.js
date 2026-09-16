const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require('discord.js');
const { setSettings } = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-kur')
        .setDescription('Kullanıcıların destek talebi açabilmesi için butonlu ticket paneli kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Ticket panelinin gönderileceği kanal')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName('kategori')
                .setDescription('Açılacak destek kanallarının toplanacağı kategori (Opsiyonel)')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(false)
        )
        .addRoleOption(option =>
            option.setName('yetkili-rol')
                .setDescription('Açılan ticket kanallarını görebilecek yetkili/destek rolü (Opsiyonel)')
                .setRequired(false)
        ),
    async execute(interaction) {
        const channel = interaction.options.getChannel('kanal');
        const category = interaction.options.getChannel('kategori');
        const staffRole = interaction.options.getRole('yetkili-rol');

        if (category) {
            setSettings(interaction.guildId, { ticketCategoryId: category.id });
        }
        // Not verilirse önceki ayar korunur; açıkça kaldırmak isteyen /ticket-kur'u rolsüz tekrar
        // çağırdığında eski rol ayarı silinmiş olmaz — bu basit kurulum komutu için kabul edilebilir,
        // rolü değiştirmek isteyen yeni bir rol seçip tekrar çalıştırabilir.
        if (staffRole) {
            setSettings(interaction.guildId, { ticketStaffRoleId: staffRole.id });
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎫 Destek Sistemi')
            .setDescription('Bir sorun, şikayet veya öneriniz mi var?\nAşağıdaki butona tıklayarak sadece yetkililerle sizin görebileceğiniz özel bir destek talebi açabilirsiniz.')
            .setFooter({ text: 'Lütfen gereksiz yere talep açmayınız.' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_ticket')
                .setLabel('Destek Talebi Aç')
                .setEmoji('📩')
                .setStyle(ButtonStyle.Primary)
        );

        await channel.send({ embeds: [embed], components: [row] });

        await interaction.reply({
            content: `✅ Destek paneli başarıyla ${channel} kanalına gönderildi!${staffRole ? `\n🛡️ Açılan ticket kanallarını **${staffRole}** rolü de görebilecek.` : '\n⚠️ Yetkili rol belirtmediniz — ticket kanallarını sadece açan kişi ve Yöneticiler görebilecek.'}`,
            ephemeral: true
        });
    },
};
