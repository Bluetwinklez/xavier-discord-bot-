const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addWarn, AUTO_TIMEOUT_THRESHOLD, AUTO_TIMEOUT_MINUTES } = require('../../utils/warnManager');
const { sendServerLog } = require('../../utils/serverLog');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uyar')
        .setDescription('Kullanıcıya resmi bir uyarı verir ve geçmişine kaydeder.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Uyarılacak kullanıcı')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Uyarı sebebi')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.ModerateMembers)) return;

        const targetUser = interaction.options.getUser('kullanici');
        const reason = interaction.options.getString('sebep');

        const { warn, count, shouldAutoTimeout } = addWarn(interaction.guildId, targetUser.id, interaction.user.id, reason);

        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('⚠️ Kullanıcı Uyarıldı')
            .addFields(
                { name: '👤 Kullanıcı', value: `${targetUser.tag}`, inline: true },
                { name: '🛡️ Yetkili', value: `${interaction.user.tag}`, inline: true },
                { name: '🔢 Toplam Uyarı', value: `${count}`, inline: true },
                { name: '📝 Sebep', value: reason, inline: false }
            )
            .setTimestamp();

        targetUser.send(`⚠️ **${interaction.guild.name}** sunucusunda uyarıldın.\n**Sebep:** ${reason}\n**Toplam uyarın:** ${count}`).catch(() => {});

        let autoTimeoutNote = '';
        if (shouldAutoTimeout) {
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (member?.moderatable) {
                try {
                    await member.timeout(AUTO_TIMEOUT_MINUTES * 60 * 1000, `Otomatik: ${AUTO_TIMEOUT_THRESHOLD} uyarıya ulaştı`);
                    autoTimeoutNote = `\n\n🔇 **${count} uyarıya ulaşıldığı için ${AUTO_TIMEOUT_MINUTES} dakika otomatik susturuldu.**`;
                } catch {}
            }
        }

        await interaction.reply({ embeds: [embed], content: autoTimeoutNote || undefined });

        sendServerLog(interaction.guild, {
            title: '⚠️ Kullanıcı Uyarıldı',
            color: 0xFFA500,
            fields: [
                { name: '👤 Kullanıcı', value: `${targetUser.tag}`, inline: true },
                { name: '🛡️ Yetkili', value: `${interaction.user.tag}`, inline: true },
                { name: '🔢 Toplam Uyarı', value: `${count}`, inline: true },
                { name: '📝 Sebep', value: reason, inline: false }
            ]
        }).catch(() => {});
    },
};
