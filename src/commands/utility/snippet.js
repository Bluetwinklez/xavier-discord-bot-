const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readJSON, writeJSON } = require('../../utils/fileStore');

const FILE_NAME = 'snippets.json';

function getSnippets(guildId) {
    const all = readJSON(FILE_NAME, {});
    return all[guildId] || {};
}

function saveSnippet(guildId, name, data) {
    const all = readJSON(FILE_NAME, {});
    if (!all[guildId]) all[guildId] = {};
    all[guildId][name.toLowerCase().trim()] = data;
    writeJSON(FILE_NAME, all);
}

function deleteSnippet(guildId, name) {
    const all = readJSON(FILE_NAME, {});
    if (all[guildId] && all[guildId][name.toLowerCase().trim()]) {
        delete all[guildId][name.toLowerCase().trim()];
        writeJSON(FILE_NAME, all);
        return true;
    }
    return false;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snippet')
        .setDescription('Kod parçacığı (Gist/Snippet) kaydetme ve arama kütüphanesi.')
        .addSubcommand(sub =>
            sub.setName('kaydet')
                .setDescription('Yeni bir kod parçacığı kaydeder.')
                .addStringOption(opt => opt.setName('isim').setDescription('Snippet adı (örn: react-modal, db-connect)').setRequired(true))
                .addStringOption(opt => opt.setName('dil').setDescription('Programlama dili (js, py, cpp vb.)').setRequired(true))
                .addStringOption(opt => opt.setName('kod').setDescription('Kod metni').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('bul')
                .setDescription('Kayıtlı bir kod parçacığını çağırır.')
                .addStringOption(opt => opt.setName('isim').setDescription('Aranan snippet adı').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('listele')
                .setDescription('Sunucuda kayıtlı tüm kod parçacıklarını listeler.')
        )
        .addSubcommand(sub =>
            sub.setName('sil')
                .setDescription('Kayıtlı bir kod parçacığını siler.')
                .addStringOption(opt => opt.setName('isim').setDescription('Silinecek snippet adı').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (sub === 'kaydet') {
            const name = interaction.options.getString('isim');
            const lang = interaction.options.getString('dil').toLowerCase().trim();
            const code = interaction.options.getString('kod').replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '');

            saveSnippet(guildId, name, {
                language: lang,
                code: code,
                author: interaction.user.tag,
                authorId: interaction.user.id,
                date: Date.now()
            });

            return interaction.reply({
                content: `✅ **"${name}"** kod parçacığı kütüphaneye kaydedildi! \`/snippet bul isim: ${name}\` ile çağırabilirsiniz.`,
                ephemeral: true
            });
        }

        if (sub === 'bul') {
            const name = interaction.options.getString('isim');
            const snippets = getSnippets(guildId);
            const found = snippets[name.toLowerCase().trim()];

            if (!found) {
                return interaction.reply({ content: `❌ **"${name}"** adında bir snippet bulunamadı.`, ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setColor(0x00FF88)
                .setTitle(`📁 Kod Snippet: ${name}`)
                .setDescription(`\`\`\`${found.language}\n${found.code.slice(0, 1800)}\n\`\`\``)
                .setFooter({ text: `Ekleyen: ${found.author} • ${found.language.toUpperCase()}` })
                .setTimestamp(new Date(found.date));

            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'listele') {
            const snippets = getSnippets(guildId);
            const keys = Object.keys(snippets);

            if (keys.length === 0) {
                return interaction.reply({ content: 'ℹ️ Sunucuda kayıtlı kod snippet\'i bulunmuyor.', ephemeral: true });
            }

            const list = keys.map(k => `• **${k}** (\`${snippets[k].language}\`) - Ekleyen: <@${snippets[k].authorId}>`).join('\n');

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`📁 Kayıtlı Kod Snippet'leri (${keys.length})`)
                .setDescription(list.slice(0, 2000))
                .setFooter({ text: 'Kullanım: /snippet bul isim: <ad>' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'sil') {
            const name = interaction.options.getString('isim');
            const deleted = deleteSnippet(guildId, name);

            if (deleted) {
                return interaction.reply({ content: `🗑️ **"${name}"** kod parçacığı silindi.`, ephemeral: true });
            } else {
                return interaction.reply({ content: `❌ **"${name}"** adında bir snippet bulunamadı.`, ephemeral: true });
            }
        }
    },
};
