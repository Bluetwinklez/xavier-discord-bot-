const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addModAction } = require('../../utils/moderationHistory');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Belirtilen kullanıcıyı sunucudan yasaklar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Yasaklanacak kullanıcı')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Yasaklama sebebi')
                .setRequired(false)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.BanMembers)) return;

        const targetUser = interaction.options.getUser('kullanici');
        const reason = interaction.options.getString('sebep') || 'Belirtilmedi';

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (member) {
            if (!member.bannable) {
                return interaction.reply({ content: '❌ Bu kullanıcıyı yasaklama yetkim yetersiz (Rolü benden yüksek veya eşit olabilir)!', ephemeral: true });
            }

            if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
                return interaction.reply({ content: '❌ Bu kullanıcının rolü sizden yüksek veya eşit olduğu için yasaklayamazsınız!', ephemeral: true });
            }
        }

        try {
            await interaction.guild.members.ban(targetUser.id, { reason: `${interaction.user.tag}: ${reason}` });
            addModAction(interaction.guildId, targetUser.id, 'ban', interaction.user.id, reason);

            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🔨 Kullanıcı Yasaklandı')
                .addFields(
                    { name: '👤 Kullanıcı', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
                    { name: '🛡️ Yetkili', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 Sebep', value: reason, inline: false }
                )
                .setTimestamp();

            // Not: ayrıca log göndermiyoruz — guildBanAdd.js native event'i bu banı zaten
            // (manuel yapılanlar dahil TÜM banları) log kanalına düşürüyor, çift kayıt olmasın diye.
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Ban hatası:', error);
            await interaction.reply({ content: '❌ Kullanıcı yasaklanırken beklenmeyen bir hata oluştu!', ephemeral: true });
        }
    },
};
