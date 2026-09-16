const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { cleanupVoice, getVoiceSession } = require('../../utils/radioCatalog');
const { stopListening } = require('../../utils/voiceListener');
const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sesten-ayril')
        .setDescription('Botun ses kanalından ve 7/24 seste kalma modundan çıkmasını sağlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        const session = getVoiceSession(interaction.guildId);
        const conn = getVoiceConnection(interaction.guildId);
        const botVoice = interaction.guild.members.me?.voice?.channel;

        if (!session && !conn && !botVoice) {
            return interaction.reply({
                content: '❌ Bot şu anda aktif bir ses kanalında değil.',
                ephemeral: true
            });
        }

        stopListening(interaction.guildId, interaction.user.id);
        cleanupVoice(interaction.guildId);
        try {
            await interaction.guild.members.me?.voice?.disconnect();
        } catch {}

        await interaction.reply({
            content: '👋 Bot ses kanalından ayrıldı ve 7/24 modu kapatıldı.'
        });
    },
};
