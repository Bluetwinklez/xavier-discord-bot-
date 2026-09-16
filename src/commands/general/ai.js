const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { askOpenClaw, splitMessage, checkAiCooldown } = require('../../utils/aiManager');
const { getSettings } = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ai')
        .setDescription('OpenClaw yapay zekası ile sohbet edin veya bir soru sorun.')
        .addStringOption(option =>
            option.setName('soru')
                .setDescription('Yapay zekaya sormak istediğiniz soru veya konu')
                .setRequired(true)
        ),
    async execute(interaction) {
        const settings = getSettings(interaction.guildId);

        // Belirlenen kanal kontrolü
        if (settings.aiChannelId && interaction.channelId !== settings.aiChannelId) {
            return interaction.reply({
                content: `❌ Yapay zeka özelliği sadece <#${settings.aiChannelId}> kanalında aktiftir! Lütfen oradan kullanın.`,
                ephemeral: true
            });
        }

        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const requiredRoleId = settings.aiRoleId;
        const hasRole = requiredRoleId && interaction.member.roles.cache.has(requiredRoleId);

        if (!isAdmin && (!requiredRoleId || !hasRole)) {
            return interaction.reply({
                content: requiredRoleId
                    ? `❌ Yapay zekayı kullanmak için <@&${requiredRoleId}> rolüne sahip olmalısınız.`
                    : '❌ Yapay zekayı kullanmak için Yönetici (Administrator) yetkisine sahip olmalısınız.',
                ephemeral: true
            });
        }

        const cooldownMs = checkAiCooldown(interaction.user.id);
        if (cooldownMs > 0) {
            return interaction.reply({ content: `⏳ Çok hızlı istek gönderiyorsun, ${Math.ceil(cooldownMs / 1000)} saniye bekle.`, ephemeral: true });
        }

        const question = interaction.options.getString('soru');
        await interaction.deferReply();

        try {
            const context = {
                guild: interaction.guild,
                channel: interaction.channel,
                member: interaction.member,
                client: interaction.client
            };
            const answer = await askOpenClaw(interaction.user.id, question, interaction.user.displayName, context);
            const chunks = splitMessage(answer);

            await interaction.editReply({ content: chunks[0] });

            for (let i = 1; i < chunks.length; i++) {
                await interaction.followUp({ content: chunks[i] });
            }
        } catch (error) {
            console.error('AI komutu hatası:', error);
            await interaction.editReply({ content: '❌ Yanıt alınırken bir hata oluştu!' });
        }
    },
};
