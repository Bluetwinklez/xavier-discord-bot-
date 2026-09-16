const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { callAIProviders } = require('../../utils/aiManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('haber-paylas')
        .setDescription('En son yapay zeka ve teknoloji haberlerini çeker, özetler ve paylaşır.'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const res = await fetch('https://dev.to/api/articles?tag=ai&per_page=3');
            if (!res.ok) throw new Error('Haber kaynağına ulaşılamadı');

            const articles = await res.json();
            if (!articles || articles.length === 0) {
                return interaction.editReply('ℹ️ Şu anda yeni bir haber akışı bulunamadı.');
            }

            const article = articles[0];

            // AI ile Türkçe özet çıkar
            const prompt = `Aşağıdaki yazılım/teknoloji makale başlığını ve etiketlerini Türkçe olarak 2 cümleyle özetle, neden önemli olduğunu açıkla:
Başlık: ${article.title}
Açıklama: ${article.description || ''}
Etiketler: ${article.tag_list.join(', ')}`;

            const summary = await callAIProviders([
                { role: 'system', content: 'Sen bir teknoloji editörüsün. Türkçe, akıcı ve ilgi çekici özet hazırla.' },
                { role: 'user', content: prompt }
            ]);

            const embed = new EmbedBuilder()
                .setColor(0x00AAFF)
                .setTitle(`⚡ ${article.title}`)
                .setURL(article.url)
                .setDescription(summary || article.description || 'Haber detayları için bağlantıya tıklayın.')
                .setThumbnail(article.social_image || article.cover_image || null)
                .addFields(
                    { name: '🏷️ Konular', value: article.tag_list.map(t => `\`#${t}\``).join(' '), inline: true },
                    { name: '✍️ Yazar', value: article.user?.name || 'Dev.to Tech Community', inline: true }
                )
                .setFooter({ text: 'Teknoloji & Yapay Zeka Gündemi' })
                .setTimestamp(new Date(article.published_at));

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Haberi Oku (Kaynak)')
                    .setStyle(ButtonStyle.Link)
                    .setURL(article.url)
            );

            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (err) {
            console.error('haber-paylas hatası:', err);
            await interaction.editReply('❌ Haberler yüklenirken bir sorun oluştu: ' + err.message);
        }
    },
};
