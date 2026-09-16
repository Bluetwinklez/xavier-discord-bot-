const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendServerLog } = require('../../utils/serverLog');
const { addModAction } = require('../../utils/moderationHistory');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Belirtilen kullanıcıyı sunucudan atar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Sunucudan atılacak kullanıcı')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Atılma sebebi')
                .setRequired(false)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.KickMembers)) return;

        const targetUser = interaction.options.getUser('kullanici');
        const reason = interaction.options.getString('sebep') || 'Belirtilmedi';

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: '❌ Bu kullanıcı sunucuda bulunamadı!', ephemeral: true });
        }

        if (!member.kickable) {
            return interaction.reply({ content: '❌ Bu kullanıcıyı atma yetkim yetersiz!', ephemeral: true });
        }

        if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
            return interaction.reply({ content: '❌ Bu kullanıcının rolü sizden yüksek veya eşit!', ephemeral: true });
        }

        try {
            await member.kick(`${interaction.user.tag}: ${reason}`);
            addModAction(interaction.guildId, targetUser.id, 'kick', interaction.user.id, reason);

            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('👢 Kullanıcı Sunucudan Atıldı')
                .addFields(
                    { name: '👤 Kullanıcı', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
                    { name: '🛡️ Yetkili', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 Sebep', value: reason, inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            sendServerLog(interaction.guild, {
                title: '👢 Kullanıcı Sunucudan Atıldı',
                color: 0xFFA500,
                fields: [
                    { name: '👤 Kullanıcı', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
                    { name: '🛡️ Yetkili', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 Sebep', value: reason, inline: false }
                ]
            }).catch(() => {});
        } catch (error) {
            console.error('Kick hatası:', error);
            await interaction.reply({ content: '❌ Kullanıcı atılırken bir hata oluştu!', ephemeral: true });
        }
    },
};
