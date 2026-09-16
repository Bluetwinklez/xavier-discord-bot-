const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBalance } = require('../../utils/economyManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bakiye')
        .setDescription('Sunucu içi para bakiyenizi gösterir.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Bakiyesi gösterilecek kullanıcı').setRequired(false)),
    async execute(interaction) {
        const target = interaction.options.getUser('kullanici') || interaction.user;
        const balance = getBalance(interaction.guildId, target.id);

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setDescription(`💰 ${target === interaction.user ? 'Bakiyeniz' : `**${target.username}** kullanıcısının bakiyesi`}: **${balance}** 🪙`);

        await interaction.reply({ embeds: [embed] });
    },
};
