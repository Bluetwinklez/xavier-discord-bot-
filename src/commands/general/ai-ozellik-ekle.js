const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addCustomCommand, addKnowledge, removeSkill, getGuildSkills } = require('../../utils/customSkillManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ai-ozellik-ekle')
        .setDescription('Yapay zekaya yeni komutlar, otomatik cevaplar veya kalıcı bilgiler öğretir')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('otomatik-cevap')
                .setDescription('Biri belirli bir kelime yazdığında yapay zekanın vereceği otomatik cevabı öğretir')
                .addStringOption(opt =>
                    opt.setName('tetikleyici')
                        .setDescription('Kullanıcının yazacağı kelime veya cümle (Örn: sa, discord linki, kurallar)')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('cevap')
                        .setDescription('Yapay zekanın vereceği otomatik yanıt')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('bilgi-ogret')
                .setDescription('Yapay zekanın hafızasına kalıcı bir kural, duyuru veya bilgi kaydeder')
                .addStringOption(opt =>
                    opt.setName('konu')
                        .setDescription('Bilginin başlığı (Örn: Yetkili Alımları, Turnuva Saati, Sunucu Amacı)')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('icerik')
                        .setDescription('Yapay zekanın aklında tutacağı detaylı bilgi/kural')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('liste')
                .setDescription('Bu sunucuda yapay zekaya öğretilen tüm özel komut ve bilgileri listeler')
        )
        .addSubcommand(sub =>
            sub.setName('sil')
                .setDescription('Öğretilmiş bir komutu veya bilgiyi siler')
                .addStringOption(opt =>
                    opt.setName('kelime')
                        .setDescription('Silmek istediğiniz komutun tetikleyicisi veya konunun adı')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (sub === 'otomatik-cevap') {
            const trigger = interaction.options.getString('tetikleyici');
            const response = interaction.options.getString('cevap');

            addCustomCommand(guildId, trigger, response);

            const embed = new EmbedBuilder()
                .setTitle('✨ Yeni Otomatik Cevap Öğretildi!')
                .setColor(0x57F287)
                .setDescription(`Artık biri **"${trigger}"** yazdığında yapay zeka şu yanıtı verecek:\n\n> ${response}`)
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'bilgi-ogret') {
            const topic = interaction.options.getString('konu');
            const content = interaction.options.getString('icerik');

            addKnowledge(guildId, topic, content);

            const embed = new EmbedBuilder()
                .setTitle('🧠 Yeni Bilgi Hafızaya Kaydedildi!')
                .setColor(0x5865F2)
                .addFields(
                    { name: '📌 Konu', value: topic, inline: true },
                    { name: '📝 Bilgi', value: content, inline: false }
                )
                .setFooter({ text: 'Üyeler bu konuyu sorduğunda yapay zeka bu bilgiyi kullanarak yanıt verecektir.' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'liste') {
            const skills = getGuildSkills(guildId);
            const cmdCount = skills.commands?.length || 0;
            const knwCount = skills.knowledge?.length || 0;

            if (cmdCount === 0 && knwCount === 0) {
                return interaction.reply({
                    content: 'ℹ️ Bu sunucuda yapay zekaya henüz özel bir komut veya bilgi öğretilmemiş.\n`/ai-ozellik-ekle otomatik-cevap` veya `/ai-ozellik-ekle bilgi-ogret` ile ekleyebilirsiniz!',
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('📚 Yapay Zekanın Sunucudaki Özel Yetenekleri')
                .setColor(0xFEE75C)
                .setTimestamp();

            if (cmdCount > 0) {
                const cmdList = skills.commands.map(c => `• **"${c.trigger}"** ➔ ${c.response}`).join('\n');
                embed.addFields({ name: `💬 Otomatik Cevaplar (${cmdCount})`, value: cmdList });
            }

            if (knwCount > 0) {
                const knwList = skills.knowledge.map(k => `• **${k.topic}:** ${k.content}`).join('\n');
                embed.addFields({ name: `🧠 Öğrenilen Bilgiler (${knwCount})`, value: knwList });
            }

            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'sil') {
            const keyword = interaction.options.getString('kelime');
            const removed = removeSkill(guildId, keyword);

            if (removed) {
                return interaction.reply({
                    content: `🗑️ **"${keyword}"** ile eşleşen özel özellik/bilgi başarıyla hafızadan silindi!`,
                    ephemeral: true
                });
            } else {
                return interaction.reply({
                    content: `❌ **"${keyword}"** ile eşleşen bir özellik veya bilgi bulunamadı.`,
                    ephemeral: true
                });
            }
        }
    }
};
