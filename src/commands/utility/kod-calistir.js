const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Judge0 CE (ce.judge0.com) — anahtarsız, açık kaynak, gerçek izole (sandbox) kod çalıştırma API'si.
// ESKİDEN bu komut kodu GERÇEKTEN ÇALIŞTIRMIYORDU: bir LLM'e "bu kodu çalıştırmış gibi çıktı üret"
// diye soruyordu (halüsinasyon riski çok yüksek — segfault, sonsuz döngü, gerçek runtime hataları
// gibi durumlarda LLM'in ürettiği "çıktı" gerçeği yansıtmıyordu), üstelik "Çalışma Süresi" etiketi
// de sadece LLM gecikmesiydi, gerçek yürütme süresi değildi.
// Not: Piston (emkc.org) denendi ama genel API'si 2026-02-15'ten beri whitelist-only (401 dönüyor);
// Judge0 CE public instance'ı canlı test edildi ve anahtarsız çalıştığı doğrulandı.
const JUDGE0_BASE = 'https://ce.judge0.com';

// Bizim slash komut seçeneklerimiz ile Judge0'ın /languages listesindeki isim kalıpları arasındaki
// eşleme. Judge0'da aynı dilin birden çok derleyici sürümü olabiliyor (ör. "Python (3.8.1)",
// "Python (3.14.0)") — dil ID'sini HARDCODE ETMİYORUZ, /languages'tan çekip en güncel sürümü
// seçiyoruz (tıpkı Gemini/Groq model isimlerinde olduğu gibi, sabit ID'ler zamanla değişebilir/
// kaldırılabilir).
const LANGUAGE_PATTERNS = {
    python: /^Python \(/,
    javascript: /^JavaScript \(/,
    typescript: /^TypeScript \(/,
    cpp: /^C\+\+ \(/,
    csharp: /^C# \(/,
    java: /^Java \(/, // "JavaFX (...)" başlamadığı için ayrı eşleşir
    go: /^Go \(/,
    rust: /^Rust \(/,
    php: /^PHP \(/
};

let languagesCache = null;
let languagesCacheAt = 0;
const LANGUAGES_CACHE_MS = 60 * 60 * 1000; // 1 saat

async function getLanguages() {
    if (languagesCache && Date.now() - languagesCacheAt < LANGUAGES_CACHE_MS) return languagesCache;
    const res = await fetch(`${JUDGE0_BASE}/languages`);
    if (!res.ok) throw new Error(`Judge0 dil listesi alınamadı (HTTP ${res.status})`);
    languagesCache = await res.json();
    languagesCacheAt = Date.now();
    return languagesCache;
}

// "C++ (GCC 14.1.0)" -> "14.1.0", "Python (3.14.0)" -> "3.14.0" gibi parantez içindeki son
// (boşlukla ayrılmış) sürüm benzeri parçayı çıkarır, karşılaştırma için kullanılır.
function extractVersionToken(name) {
    const match = name.match(/\(([^)]*)\)/);
    if (!match) return '0';
    const parts = match[1].trim().split(/\s+/);
    return parts[parts.length - 1];
}

async function resolveLanguage(language) {
    const pattern = LANGUAGE_PATTERNS[language];
    if (!pattern) return null;
    const languages = await getLanguages();
    const matches = languages.filter(l => pattern.test(l.name));
    if (matches.length === 0) return null;
    matches.sort((a, b) => extractVersionToken(b.name).localeCompare(extractVersionToken(a.name), undefined, { numeric: true }));
    return matches[0];
}

async function runOnJudge0(languageId, code) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
        const res = await fetch(`${JUDGE0_BASE}/submissions?base64_encoded=false&wait=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                language_id: languageId,
                source_code: code,
                cpu_time_limit: 8,
                wall_time_limit: 12
            }),
            signal: controller.signal
        });
        if (!res.ok) throw new Error(`Judge0 çalıştırma isteği başarısız (HTTP ${res.status})`);
        return await res.json();
    } finally {
        clearTimeout(timeoutId);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kod-calistir')
        .setDescription('Yazdığınız kodu güvenli sandbox ortamında gerçekten çalıştırır ve çıktısını gösterir.')
        .addStringOption(opt =>
            opt.setName('dil')
                .setDescription('Programlama dilini seçin')
                .setRequired(true)
                .addChoices(
                    { name: 'Python', value: 'python' },
                    { name: 'JavaScript / Node.js', value: 'javascript' },
                    { name: 'TypeScript', value: 'typescript' },
                    { name: 'C++', value: 'cpp' },
                    { name: 'C#', value: 'csharp' },
                    { name: 'Java', value: 'java' },
                    { name: 'Go (Golang)', value: 'go' },
                    { name: 'Rust', value: 'rust' },
                    { name: 'PHP', value: 'php' }
                )
        )
        .addStringOption(opt =>
            opt.setName('kod')
                .setDescription('Çalıştırılacak kod metnini girin')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const language = interaction.options.getString('dil');
        let code = interaction.options.getString('kod');

        // Markdown kod bloklarını temizle
        code = code.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();

        const startTime = Date.now();

        try {
            const langInfo = await resolveLanguage(language);
            if (!langInfo) {
                return interaction.editReply(`❌ Judge0 bu dil için şu an bir çalışma zamanı sunmuyor: **${language}**.`);
            }

            const result = await runOnJudge0(langInfo.id, code);
            const durationMs = Date.now() - startTime;

            // status.id: 3 = Kabul edildi (Accepted), 6 = Derleme Hatası, diğerleri (TLE, runtime
            // error türleri vb.) description alanında insan-okunabilir olarak geliyor.
            const statusId = result.status?.id;
            const isCompileError = statusId === 6;
            const isError = statusId !== 3;

            let outputText;
            if (isCompileError) {
                outputText = `[Derleme Hatası]\n${result.compile_output || 'Bilinmeyen derleme hatası'}`;
            } else if (isError) {
                outputText = `[${result.status?.description || 'Hata'}]\n${result.stderr || result.message || result.stdout || 'Çıktı yok'}`;
            } else {
                outputText = result.stdout || '(Çıktı yok)';
            }

            const embed = new EmbedBuilder()
                .setColor(isError ? 0xE74C3C : 0x00FF88)
                .setTitle(`💻 Kod Çalıştırıldı: ${langInfo.name}`)
                .addFields(
                    { name: '📝 Kod', value: `\`\`\`${language}\n${code.slice(0, 500)}${code.length > 500 ? '...' : ''}\n\`\`\``, inline: false },
                    { name: isError ? '📤 Hata Çıktısı' : '📤 Terminal Çıktısı', value: `\`\`\`text\n${(outputText || '(boş)').slice(0, 1000)}\n\`\`\``, inline: false }
                )
                .setFooter({ text: `Gerçek çalışma süresi: ${durationMs}ms (sandbox: ${result.time ? result.time + 's' : '?'}) • İsteyen: ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('kod-calistir hatası:', err);
            await interaction.editReply('❌ Kod çalıştırılırken bir hata oluştu: ' + err.message);
        }
    },
};
