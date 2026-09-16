const { Events, ChannelType, EmbedBuilder } = require('discord.js');
const { setSettings } = require('../utils/database');
const { buildHelpEmbed } = require('../commands/general/yardim');
const logger = require('../utils/logger');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild) {
        logger.info(`📥 Yeni sunucuya katılındı: ${guild.name} (${guild.id})`);

        try {
            const channel = await guild.channels.create({
                name: '🤖│yapay-zeka-llm',
                type: ChannelType.GuildText,
                topic: 'AI sohbet kanalı — buraya yazılan her mesaja bot otomatik yanıt verir.'
            });

            setSettings(guild.id, { aiChannelId: channel.id });

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('👋 Merhaba! Sunucunuza katıldım.')
                .setDescription(
                    `Bu kanalı **AI sohbet kanalınız** olarak ayarladım — buraya yazdığınız her mesaja otomatik cevap veririm, etiketlemenize gerek yok.\n\n` +
                    `📌 İstediğiniz zaman \`/ai-kanal-ayarla\` ile bu kanalı değiştirebilirsiniz.\n` +
                    `🔒 Bu kanalı ben kendiliğimden silmem — sadece siz (Yönetici) silerseniz kaldırılır.\n\n` +
                    `Aşağıda tüm komutlarımın tam listesini bulabilirsiniz \`(/yardim\` ile istediğiniz zaman tekrar çağırabilirsiniz)\`:`
                )
                .setTimestamp();

            // Karşılama mesajının hemen ardından, eskiden sadece "/yardim yazabilirsiniz" diyordu —
            // artık tam komut rehberini de otomatik gönderiyoruz, yönetici hiç komut yazmadan görsün.
            await channel.send({ embeds: [embed] });
            await channel.send({ embeds: [buildHelpEmbed(guild.client)] });
        } catch (err) {
            logger.error(`AI kanalı otomatik oluşturulamadı (${guild.name}):`, err);
        }
    },
};
