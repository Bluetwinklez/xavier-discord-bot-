const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { setupStarboard } = require('../../utils/starboard');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('starboard-kur')
        .setDescription('Çok tepki alan mesajları öne çıkaran starboard sistemini kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Öne çıkan mesajların gönderileceği kanal')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('esik')
                .setDescription('Kaç tepki alınca öne çıkarılsın (varsayılan: 3)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(50)
        )
        .addStringOption(option =>
            option.setName('emoji')
                .setDescription('Kullanılacak tepki emojisi (varsayılan: ⭐)')
                .setRequired(false)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.ManageGuild)) return;

        const channel = interaction.options.getChannel('kanal');
        const threshold = interaction.options.getInteger('esik') || 3;
        const emoji = interaction.options.getString('emoji') || '⭐';

        setupStarboard(interaction.guildId, channel.id, threshold, emoji);

        await interaction.reply(`${emoji} Starboard kuruldu! Bir mesaj **${threshold}** ${emoji} tepki alınca ${channel} kanalında öne çıkarılacak.`);
    },
};
