const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { renderAiPanel } = require('../../utils/aiPanel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ai-panel')
        .setDescription('Yapay zeka mod, kanal ve rol ayarlarını tek bir panelden yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const view = await renderAiPanel(interaction.guild);
        await interaction.reply({ ...view, ephemeral: true });
    },
};
