const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendServerLog } = require('../../utils/serverLog');
const { addModAction } = require('../../utils/moderationHistory');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Kullanıcıya geçici susturma (zaman aşımı) uygular.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Susturulacak kullanıcı')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('dakika')
                .setDescription('Susturma süresi (dakika cinsinden)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(40320) // Maks 28 gün (Discord sınırı)
        )
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Susturma sebebi')
                .setRequired(false)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.ModerateMembers)) return;

        const targetUser = interaction.options.getUser('kullanici');
        const minutes = interaction.options.getInteger('dakika');
        const reason = interaction.options.getString('sebep') || 'Belirtilmedi';

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: '❌ Bu kullanıcı sunucuda bulunamadı!', ephemeral: true });
        }

        if (!member.moderatable) {
            return interaction.reply({ content: '❌ Bu kullanıcıya ceza uygulama yetkim yetersiz!', ephemeral: true });
        }

        if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
            return interaction.reply({ content: '❌ Bu kullanıcının rolü sizden yüksek veya eşit!', ephemeral: true });
        }

        try {
            const durationMs = minutes * 60 * 1000;
            await member.timeout(durationMs, `${interaction.user.tag}: ${reason}`);
            addModAction(interaction.guildId, targetUser.id, 'timeout', interaction.user.id, `${reason} (${minutes} dk)`);

            const embed = new EmbedBuilder()
                .setColor(0xFFFF00)
                .setTitle('⏳ Kullanıcı Susturuldu (Timeout)')
                .addFields(
                    { name: '👤 Kullanıcı', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
                    { name: '⏱️ Süre', value: `${minutes} dakika`, inline: true },
                    { name: '🛡️ Yetkili', value: `${interaction.user.tag}`, inline: false },
                    { name: '📝 Sebep', value: reason, inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            sendServerLog(interaction.guild, {
                title: '⏳ Kullanıcı Susturuldu',
                color: 0xFFFF00,
                fields: [
                    { name: '👤 Kullanıcı', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
                    { name: '⏱️ Süre', value: `${minutes} dakika`, inline: true },
                    { name: '🛡️ Yetkili', value: `${interaction.user.tag}`, inline: false },
                    { name: '📝 Sebep', value: reason, inline: false }
                ]
            }).catch(() => {});
        } catch (error) {
            console.error('Timeout hatası:', error);
            await interaction.reply({ content: '❌ Susturma işlemi uygulanırken bir hata oluştu!', ephemeral: true });
        }
    },
};
