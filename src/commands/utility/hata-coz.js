const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { callAIProviders } = require('../../utils/aiManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hata-coz')
        .setDescription('Karşılaştığınız kodlama veya terminal hatasını analiz eder ve kesin çözümü sunar.')
        .addStringOption(opt =>
            opt.setName('hata_mesaji')
                .setDescription('Terminaldeki veya konsoldaki hata çıktısını girin')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('kod')
                .setDescription('Hata veren ilgili kod parçasını girin (opsiyonel)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const errorMessage = interaction.options.getString('hata_mesaji');
        const codeSnippet = interaction.options.getString('kod') || '';

        const prompt = `Kullanıcı bir yazılım hatasıyla karşılaştı.
Hata Metni:
\`\`\`text
${errorMessage}
\`\`\`

${codeSnippet ? `İlgili Kod Bloğu:\n\`\`\`\n${codeSnippet}\n\`\`\`\n` : ''}

Lütfen:
1. Hatanın kesin nedenini 1-2 cümlede açıkla.
2. Bu hatanın adım adım çözümünü ve gerekiyorsa düzeltilmiş kod parçalarını (markdown kod bloğuyla) ver.
Türkçe, net ve doğrudan çözüme odaklı ol.`;

        try {
            const solution = await callAIProviders([
                { role: 'system', content: 'Sen StackOverflow uzmanı kıdemli bir yazılım mühendisisin. Hataları hızlıca teşhis eder ve net kodlu çözümler sunarsın.' },
                { role: 'user', content: prompt }
            ]);

            const cleanSolution = solution || '❌ Bu hata için net bir çözüm üretilemedi.';

            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('🛠️ AI Hata Teşhis & Çözüm Asistanı')
                .addFields(
                    { name: '⚠️ Karşılaşılan Hata', value: `\`\`\`text\n${errorMessage.slice(0, 300)}\n\`\`\``, inline: false },
                    { name: '💡 Çözüm & Düzeltme', value: cleanSolution.slice(0, 1024), inline: false }
                )
                .setFooter({ text: `Yazılım Destek • İsteyen: ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('hata-coz hatası:', err);
            await interaction.editReply('❌ Hata çözülürken bir sorun oluştu: ' + err.message);
        }
    },
};
