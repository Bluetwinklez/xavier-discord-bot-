// İnteraktif kurulum sihirbazı: .env.example'daki her değişkeni (tek kaynak - burada
// TEKRAR listelenmiyor) sırayla sorar ve cevapları .env dosyasına yazar. .env zaten
// varsa mevcut değerler varsayılan olarak gösterilir, Enter'a basmak onları korur —
// yani script tekrar çalıştırılıp sadece eksik/yeni alanlar doldurulabilir.
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const EXAMPLE_PATH = path.join(__dirname, '.env.example');
const ENV_PATH = path.join(__dirname, '.env');

function parseEnvFile(content) {
    const map = {};
    for (const line of content.split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m) map[m[1]] = m[2];
    }
    return map;
}

// .env.example'ı tarar: her "KEY=..." veya "# KEY=..." satırı için, hemen üstündeki
// ardışık yorum satırlarını açıklama olarak toplar. commentedOut=true olanlar (örn.
// GUILD_ID, tüm AI anahtarları) nadiren gereken opsiyonel alanlardır.
function parseTemplate(content) {
    const lines = content.split(/\r?\n/);
    const fields = [];
    let pendingComment = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === '') { pendingComment = []; continue; }
        const commentedField = trimmed.match(/^#\s*([A-Z0-9_]+)=(.*)$/);
        if (commentedField) {
            fields.push({ key: commentedField[1], defaultValue: commentedField[2], commentedOut: true, description: pendingComment.join(' ') });
            pendingComment = [];
            continue;
        }
        if (trimmed.startsWith('#')) {
            pendingComment.push(trimmed.replace(/^#\s?/, ''));
            continue;
        }
        const activeField = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
        if (activeField) {
            fields.push({ key: activeField[1], defaultValue: activeField[2], commentedOut: false, description: pendingComment.join(' ') });
            pendingComment = [];
        }
    }
    return fields;
}

const isSecret = key => /TOKEN|API_KEY/.test(key);
const isPlaceholder = value => value.startsWith('BURAYA_');

// rl.question() ile ART ARDA soru sormak, piped/non-TTY girdide (örn. otomatik test veya
// CI) stdin EOF'a ulaşınca readline'ın arayüzü kapatıp bekleyen soruları sessizce
// düşürmesi yüzünden ikinci sorudan itibaren SONSUZA KADAR askıda kalabiliyor (bilinen bir
// Node readline kısıtı). Bunun yerine tüm satırları 'line' event'inden bir kuyruğa alıp
// oradan tüketiyoruz — hem TTY hem non-TTY girdide güvenilir çalışır.
// Girdi akışı (stdin) sorular bitmeden kapanırsa (örn. yetersiz satırlı bir pipe) bekleyen
// nextLine() çağrısı sonsuza kadar askıda kalıp script'in hiçbir şey yazmadan sessizce
// çıkmasına yol açardı — 'close' event'inde bekleyeni null ile çözüp bunu net bir hataya çeviriyoruz.
function createLineReader(rl) {
    const queue = [];
    let waiting = null;
    rl.on('line', line => {
        if (waiting) { const resolve = waiting; waiting = null; resolve(line); }
        else queue.push(line);
    });
    rl.on('close', () => {
        if (waiting) { const resolve = waiting; waiting = null; resolve(null); }
    });
    return () => {
        if (queue.length) return Promise.resolve(queue.shift());
        return new Promise(resolve => { waiting = resolve; });
    };
}

async function ask(nextLine, question) {
    process.stdout.write(question);
    const line = await nextLine();
    if (line === null) {
        console.error('\n❌ Girdi akışı kurulum bitmeden kapandı, hiçbir şey kaydedilmedi.');
        process.exit(1);
    }
    return line;
}

async function main() {
    if (!fs.existsSync(EXAMPLE_PATH)) {
        console.error('❌ .env.example bulunamadı, kurulum sihirbazı çalıştırılamıyor.');
        process.exit(1);
    }

    const template = fs.readFileSync(EXAMPLE_PATH, 'utf8');
    const fields = parseTemplate(template);
    const existing = fs.existsSync(ENV_PATH) ? parseEnvFile(fs.readFileSync(ENV_PATH, 'utf8')) : {};
    const isUpdate = Object.keys(existing).length > 0;

    console.log('\n🤖 Discord Bot Kurulum Sihirbazı');
    console.log(isUpdate
        ? 'Mevcut .env bulundu — bir alanı değiştirmeden geçmek için Enter\'a bas.\n'
        : 'Yeni bir .env oluşturulacak. Zorunlu olmayan alanları boş geçebilirsin (sadece Enter).\n');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
    const nextLine = createLineReader(rl);
    const answers = {};

    for (const field of fields) {
        const currentValue = existing[field.key] ?? (field.commentedOut ? '' : field.defaultValue);
        const alreadySet = currentValue && !isPlaceholder(currentValue);
        const required = !field.commentedOut && isPlaceholder(field.defaultValue) && !alreadySet;

        console.log(`\n${field.key}${required ? '  (ZORUNLU)' : '  (opsiyonel)'}${field.description ? ` — ${field.description}` : ''}`);
        const defaultHint = alreadySet ? (isSecret(field.key) ? ` [${'*'.repeat(Math.min(currentValue.length, 12))}]` : ` [${currentValue}]`) : '';

        let answer = await ask(nextLine, `> ${defaultHint} `);
        while (required && !answer.trim()) {
            console.log('   ⚠️  Bu alan zorunlu, boş bırakılamaz.');
            answer = await ask(nextLine, '> ');
        }

        answers[field.key] = answer.trim() ? answer.trim() : (alreadySet ? currentValue : (field.commentedOut ? '' : field.defaultValue));
    }

    rl.close();

    // .env.example'ın yapısını (yorumlar, boşluklar, sıralama) koruyarak sadece değerleri yerleştirir.
    const outLines = template.split(/\r?\n/).map(line => {
        const trimmed = line.trim();
        const m = trimmed.match(/^#?\s*([A-Z0-9_]+)=(.*)$/);
        if (!m || !(m[1] in answers)) return line;
        const value = answers[m[1]];
        if (!value) return trimmed.startsWith('#') ? line : `${m[1]}=`;
        return `${m[1]}=${value}`;
    });

    fs.writeFileSync(ENV_PATH, outLines.join('\n') + '\n', 'utf8');
    console.log(`\n✅ .env dosyası ${isUpdate ? 'güncellendi' : 'oluşturuldu'}.`);
    console.log('Şimdi şunları çalıştırabilirsin:\n  npm install   (henüz yapmadıysan)\n  npm run deploy\n  npm start\n');
}

main().catch(err => {
    console.error('❌ Kurulum sırasında hata:', err.message);
    process.exit(1);
});
