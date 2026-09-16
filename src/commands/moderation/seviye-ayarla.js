const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getSettings, setSettings } = require('../../utils/database');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seviye-ayarla')
        .setDescription('Seviye/XP sistemini, bildirim kanalını veya seviye rol ödüllerini ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addBooleanOption(option =>
            option.setName('aktif')
                .setDescription('true = aç, false = kapat')
                .setRequired(false)
        )
        .addChannelOption(option =>
            option.setName('bildirim-kanali')
                .setDescription('Seviye atlama mesajlarının gönderileceği kanal')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName('odul-seviye')
                .setDescription('Rol ödülü verilecek seviye (örn: 5, 10, 25)')
                .setMinValue(1)
                .setRequired(false)
        )
        .addRoleOption(option =>
            option.setName('odul-rol')
                .setDescription('Bu seviyeye ulaşınca otomatik verilecek rol')
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.Administrator)) return;

        const aktif = interaction.options.getBoolean('aktif');
        const channel = interaction.options.getChannel('bildirim-kanali');
        const odulSeviye = interaction.options.getInteger('odul-seviye');
        const odulRol = interaction.options.getRole('odul-rol');

        const currentSettings = getSettings(interaction.guildId);
        const update = {};

        if (aktif !== null) update.levelSystemEnabled = aktif;
        if (channel) update.levelUpChannelId = channel.id;

        const parts = [];
        if (aktif !== null) parts.push(aktif ? '✅ Seviye sistemi **açıldı**.' : '🛑 Seviye sistemi **kapatıldı**.');
        if (channel) parts.push(`📢 Seviye atlama bildirimleri artık ${channel} kanalına gönderilecek.`);

        if (odulSeviye && odulRol) {
            const levelRoles = currentSettings.levelRoles || {};
            levelRoles[odulSeviye] = odulRol.id;
            update.levelRoles = levelRoles;
            parts.push(`🎖️ **Seviye ${odulSeviye}**'e ulaşan üyelere otomatik olarak ${odulRol} rolü verilecek!`);
        }

        if (Object.keys(update).length > 0) {
            setSettings(interaction.guildId, update);
        }

        if (parts.length === 0) parts.push('ℹ️ Herhangi bir değişiklik belirtilmedi.');

        await interaction.reply(parts.join('\n'));
    },
};
