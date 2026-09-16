const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sozluk')
        .setDescription('İngilizce bir kelimenin anlamını ve telaffuzunu gösterir. (Kaynak: dictionaryapi.dev)')
        .addStringOption(option =>
            option.setName('kelime')
                .setDescription('Anlamı aranacak İngilizce kelime')
                .setRequired(true)
        ),
    async execute(interaction) {
        const word = interaction.options.getString('kelime').trim().toLowerCase();
        await interaction.deferReply();

        try {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);

            if (!res.ok) {
                return interaction.editReply(`❌ **"${word}"** kelimesi sözlükte bulunamadı. (Not: Bu sözlük sadece İngilizce kelimeleri destekler)`);
            }

            const data = await res.json();
            const entry = data[0];
            const phonetic = entry.phonetic || entry.phonetics?.find(p => p.text)?.text || '';

            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle(`📖 ${entry.word}${phonetic ? ` ${phonetic}` : ''}`)
                .setFooter({ text: 'Kaynak: dictionaryapi.dev (İngilizce)' })
                .setTimestamp();

            for (const meaning of entry.meanings.slice(0, 3)) {
                const defs = meaning.definitions.slice(0, 2)
                    .map((d, i) => `${i + 1}. ${d.definition}${d.example ? `\n   *"${d.example}"*` : ''}`)
                    .join('\n');
                embed.addFields({ name: `📌 ${meaning.partOfSpeech}`, value: defs });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Sözlük hatası:', error);
            await interaction.editReply('❌ Kelime aranırken bir hata oluştu.');
        }
    },
};
