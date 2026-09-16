const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { transfer } = require('../../utils/economyManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('Başka bir kullanıcıya para gönderin.')
        .addUserOption(opt => opt.setName('kullanici').setDescription('Para gönderilecek kullanıcı').setRequired(true))
        .addIntegerOption(opt => opt.setName('miktar').setDescription('Gönderilecek miktar').setRequired(true).setMinValue(1)),
    async execute(interaction) {
        const target = interaction.options.getUser('kullanici');
        const amount = interaction.options.getInteger('miktar');

        if (target.id === interaction.user.id) {
            return interaction.reply({ content: '❌ Kendinize para gönderemezsiniz!', ephemeral: true });
        }
        if (target.bot) {
            return interaction.reply({ content: '❌ Botlara para gönderemezsiniz!', ephemeral: true });
        }

        const result = transfer(interaction.guildId, interaction.user.id, target.id, amount);

        if (!result.ok) {
            return interaction.reply({ content: `❌ Yetersiz bakiye! Mevcut bakiyeniz: **${result.balance}** 🪙`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setDescription(`✅ **${target.username}** kullanıcısına **${amount}** 🪙 gönderildi.\n💰 Yeni bakiyeniz: **${result.fromBalance}** 🪙`);

        await interaction.reply({ embeds: [embed] });
    },
};
