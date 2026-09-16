const { trackMemberLeave } = require('../utils/inviteTracker');
const { Events, EmbedBuilder } = require('discord.js');
const { getSettings } = require('../utils/database');
const { sendServerLog } = require('../utils/serverLog');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        const guild = member.guild;
        const settings = getSettings(guild.id);
        const inviterId = trackMemberLeave(member);

        sendServerLog(guild, {
            title: '📤 Üye Ayrıldı',
            color: 0xE74C3C,
            fields: [
                { name: '👤 Kullanıcı', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
                { name: '👥 Kalan Üye Sayısı', value: `${guild.memberCount}`, inline: true }
            ]
        }).catch(() => {});

        // Herkese açık veda mesajı (karşılama kanalı ile aynı kanala gönderilir)
        if (settings.welcomeChannelId) {
            const channel = guild.channels.cache.get(settings.welcomeChannelId);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor(0xE74C3C)
                    .setTitle('👋 Güle Güle!')
                    .setDescription(`**${member.user.tag}** aramızdan ayrıldı.\nGeriye **${guild.memberCount}** kişi kaldık.`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: `${guild.name} Topluluğu` })
                    .setTimestamp();

                channel.send({ embeds: [embed] }).catch(() => {});
            }
        }
    },
};
