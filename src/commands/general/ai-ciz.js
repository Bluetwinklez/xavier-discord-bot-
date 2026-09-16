const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ai-ciz')
        .setDescription('Yapay zeka ile hayal ettiğiniz resmi sıfırdan çizer.')
        .addStringOption(opt =>
            opt.setName('prompt')
                .setDescription('Çizilmesini istediğiniz sahneyi detaylıca tarif edin (Türkçe veya İngilizce)')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('stil')
                .setDescription('Görsel tarzı (isteğe bağlı)')
                .addChoices(
                    { name: 'Siberpunk / Neon', value: 'cyberpunk neon style, highly detailed 8k' },
                    { name: 'Anime / Manga', value: 'anime art style, vibrant colors, makoto shinkai aesthetic' },
                    { name: 'Gerçekçi Fotoğraf', value: 'photorealistic, 8k resolution, cinematic lighting, shot on 35mm lens' },
                    { name: 'Fantastik / Büyülü', value: 'fantasy concept art, ethereal glow, matte painting' },
                    { name: 'Piksel Sanatı', value: 'pixel art, 16-bit retro game aesthetic' },
                    { name: 'Dijital İllüstrasyon', value: 'digital painting, modern trending artstation' }
                )
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const rawPrompt = interaction.options.getString('prompt');
        const style = interaction.options.getString('stil') || '';
        const fullPrompt = style ? `${rawPrompt}, ${style}` : rawPrompt;

        const seed = Math.floor(Math.random() * 9999999);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('🎨 Yapay Zeka Sanatı')
            .setDescription(`**İstem (Prompt):**\n*${rawPrompt}*`)
            .setImage(imageUrl)
            .setFooter({ text: `Tasarımcı: ${interaction.user.tag} • Model: Pollinations Flux Engine` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Orijinal Boyut (HD)')
                .setStyle(ButtonStyle.Link)
                .setURL(imageUrl)
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
    },
};
