const { Events } = require('discord.js');
const { sendServerLog } = require('../utils/serverLog');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        if (!message.guild) return;
        if (message.author?.bot) return;

        const rawContent = message.content || '*(içerik önbellekte yok — mesaj botun açılışından önce atılmış olabilir)*';
        const content = rawContent.length > 500 ? `${rawContent.slice(0, 500)}...` : rawContent;

        sendServerLog(message.guild, {
            title: '🗑️ Mesaj Silindi',
            color: 0xE67E22,
            description: content,
            fields: [
                { name: '👤 Yazan', value: message.author ? `${message.author.tag}` : 'Bilinmiyor', inline: true },
                { name: '📍 Kanal', value: `${message.channel}`, inline: true },
                { name: '🆔 Mesaj ID', value: `\`${message.id}\``, inline: true }
            ]
        }).catch(() => {});
    },
};
