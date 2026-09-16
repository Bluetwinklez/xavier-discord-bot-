const { cacheGuildInvites } = require('../utils/inviteTracker');
const { Events, ActivityType } = require('discord.js');
const { pruneMissingChannels } = require('../utils/tempVoiceManager');
const { startStatsUpdateLoop } = require('../utils/statsChannels');
const { startBirthdayCheckLoop } = require('../utils/birthdayManager');
const { startReminderCheckLoop } = require('../utils/reminderManager');
const { resumeGiveaways } = require('../utils/giveawayManager');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`\n=============================================`);
        console.log(`✅ Bot Başarıyla Giriş Yaptı: ${client.user.tag}`);
        console.log(`🌐 Bulunduğu Sunucu Sayısı: ${client.guilds.cache.size}`);
        console.log(`=============================================\n`);

        client.user.setPresence({
            activities: [{ name: '/yardim | Çok İşlevli Bot', type: ActivityType.Custom }],
            status: 'online'
        });

        // Bot kapalıyken elle silinmiş geçici odaları hafızadan temizle
        pruneMissingChannels(client);

        // İstatistik kanallarını periyodik güncelleme döngüsünü başlat (10dk'da bir)
        startStatsUpdateLoop(client);

        // Doğum günü kontrol döngüsünü başlat (saatte bir)
        startBirthdayCheckLoop(client);

        // Hatırlatıcı kontrol döngüsünü başlat (30sn'de bir)
        startReminderCheckLoop(client);

        // Davetleri önbelleğe al
        client.guilds.cache.forEach(g => cacheGuildInvites(g));

        // Bot yeniden başlamış olsa bile devam eden çekilişleri diskten geri yükle
        resumeGiveaways(client);
    },
};
