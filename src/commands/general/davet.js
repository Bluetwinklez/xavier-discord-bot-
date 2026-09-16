const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserInvites, getInviteLeaderboard } = require('../../utils/inviteTracker');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('davet')
        .setDescription('Sunucudaki davet istatistiklerini ve liderlik sıralamasını görüntüler.')
        .addSubcommand(sub =>
            sub.setName('istatistik')
                .setDescription('Kullanıcının davet sayılarını gösterir.')
                .addUserOption(opt => opt.setName('kullanici').setDescription('Davetlerine bakılacak kullanıcı'))
        )
        .addSubcommand(sub =>
            sub.setName('siralama')
                .setDescription('En çok üye davet edenlerin liderlik tablosunu gösterir.')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'istatistik') {
            const targetUser = interaction.options.getUser('kullanici') || interaction.user;
            const stats = getUserInvites(interaction.guildId, targetUser.id);

            const embed = new EmbedBuilder()
                .setColor(0x00FF88)
                .setTitle(`📨 ${targetUser.username} Davet İstatistikleri`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '✨ Toplam Geçerli Davet', value: `**${stats.total}**`, inline: true },
                    { name: '✅ Gerçek Davetler', value: `${stats.regular}`, inline: true },
                    { name: '⚠️ Sahte (Yeni) Hesap', value: `${stats.fake}`, inline: true },
                    { name: '🚪 Ayrılanlar', value: `${stats.left}`, inline: true }
                )
                .setFooter({ text: `${interaction.guild.name} Davet Takip Sistemi` })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'siralama') {
            const top = getInviteLeaderboard(interaction.guildId, 10);

            if (top.length === 0) {
                return interaction.reply({ content: 'ℹ️ Henüz kaydedilmiş bir davet bulunmuyor.', ephemeral: true });
            }

            const lines = top.map((entry, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `**#${idx + 1}**`;
                return `${medal} <@${entry.userId}> ➔ **${entry.total}** Davet *(+${entry.regular} normal, -${entry.left} ayrılan)*`;
            });

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle(`🏆 ${interaction.guild.name} Davet Liderlik Tablosu`)
                .setDescription(lines.join('\n\n'))
                .setFooter({ text: 'Davet Takip Sistemi' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    },
};
