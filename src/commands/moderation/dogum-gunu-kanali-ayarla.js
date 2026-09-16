const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { setSettings } = require('../../utils/database');
const { ensureBirthdayRole } = require('../../utils/birthdayManager');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dogum-gunu-kanali-ayarla')
        .setDescription('Doğum günü kutlama mesajlarının gönderileceği kanalı ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Kutlama kanalı')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.ManageGuild)) return;

        const channel = interaction.options.getChannel('kanal');
        setSettings(interaction.guildId, { birthdayChannelId: channel.id });
        await ensureBirthdayRole(interaction.guild).catch(() => {});

        await interaction.reply(`🎂 Doğum günü kutlamaları artık ${channel} kanalına gönderilecek. Üyeler \`/dogum-gunu-ayarla\` ile kendi doğum gününü kaydedebilir.`);
    },
};
