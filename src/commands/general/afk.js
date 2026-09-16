const { SlashCommandBuilder } = require('discord.js');
const { setAfk } = require('../../utils/afkManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('AFK (uzakta) durumuna geçersiniz.')
        .addStringOption(opt => opt.setName('sebep').setDescription('AFK sebebi').setRequired(false)),
    async execute(interaction) {
        const reason = interaction.options.getString('sebep') || 'Belirtilmedi';
        setAfk(interaction.guildId, interaction.user.id, reason);
        await interaction.reply(`💤 ${interaction.user} artık AFK: **${reason}**`);
    },
};
