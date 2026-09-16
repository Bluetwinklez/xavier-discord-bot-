const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getRulesEmbeds } = require('../../utils/rulesTemplate');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kurallar-gonder')
        .setDescription('Belirtilen kanala Gaming Kuralları panosunu ve afişini gönderir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Kuralların gönderileceği metin kanalı (Boş bırakılırsa mevcut kanal)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.Administrator)) return;

        const targetChannel = interaction.options.getChannel('kanal') || interaction.channel;
        const { embeds, files } = getRulesEmbeds();

        try {
            await targetChannel.send({ embeds, files });
            await interaction.reply({
                content: `✅ Kurallar panosu ve afişi ${targetChannel} kanalına başarıyla gönderildi!`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Kurallar panosu gönderilirken hata:', error);
            await interaction.reply({
                content: '❌ Kurallar gönderilirken bir hata oluştu!',
                ephemeral: true
            });
        }
    },
};
