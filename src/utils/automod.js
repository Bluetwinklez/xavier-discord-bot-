// Otomatik moderasyon: yasaklı kelime, davet linki ve spam kontrolü.
const { PermissionFlagsBits } = require('discord.js');
const { getSettings, setSettings } = require('./database');

const INVITE_REGEX = /(discord\.gg|discord(?:app)?\.com\/invite)\/[a-z0-9-]+/i;

// guildId-userId -> [timestamp, timestamp, ...] (spam tespiti için kısa süreli mesaj geçmişi)
const recentMessages = new Map();

// JS'in varsayılan toLowerCase()'i Türkçe büyük İ'yi düz 'i' değil 'i̇' (i + görünmez birleşen
// nokta) yapar — yasaklı kelime listesine düz küçük harfle eklenen bir kelime, kullanıcı onu
// Türkçe büyük İ ile yazınca bu yüzden eşleşmiyordu (filtre atlatılabiliyordu). toLocaleLowerCase
// ile 'tr' locale'i kullanmak bunu doğru çeviriyor.
function normalizeForFilter(text) {
    return (text || '').toLocaleLowerCase('tr').normalize('NFKC');
}

// Türkçe'ye özgü harfleri de "kelime karakteri" sayan basit bir sınır kontrolü — JS'in \b'si
// sadece ASCII [A-Za-z0-9_] tanır, Türkçe harflerde yanlış yerden böler. Bu olmadan düz substring
// kontrolü hem çok fazla yanlış pozitif üretiyordu (ör. yasaklı "sik" kelimesi "sikke" içinde de
// tetikleniyordu) hem de format kolaylığı sağlamıyordu.
const TR_WORD_CHAR = /[a-z0-9çğıöşü]/;
function containsWholeWord(haystack, needle) {
    if (!needle) return false;
    let idx = haystack.indexOf(needle);
    while (idx !== -1) {
        const before = idx > 0 ? haystack[idx - 1] : '';
        const after = idx + needle.length < haystack.length ? haystack[idx + needle.length] : '';
        if (!TR_WORD_CHAR.test(before) && !TR_WORD_CHAR.test(after)) return true;
        idx = haystack.indexOf(needle, idx + 1);
    }
    return false;
}

// İkinci, agresif kontrol katmanı: yasaklı kelime kontrolü kelime sınırına saygılı ama basit
// ayraç/leetspeak ile ("k.u.f.u.r", "k u f u r", "kkuuffuurr", "kuf4r") hâlâ atlatılabiliyordu.
// Tüm boşluk/noktalama işaretlerini kaldırıp yaygın leet harflerini gerçek karşılığına çevirerek
// ve art arda tekrar eden harfleri tekile indirerek İKİNCİ bir substring kontrolü yapıyoruz —
// birincisinin (kelime sınırlı) YERİNE değil, ONA EK olarak; tek başına biraz daha fazla yanlış
// pozitif üretebilir ama sadece yasaklı kelime listesine bilerek eklenmiş kelimeler için çalışır.
const LEET_MAP = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };
function stripForBypassCheck(text) {
    let s = (text || '').toLocaleLowerCase('tr').normalize('NFKC');
    s = s.replace(/[01345789@$!]/g, ch => LEET_MAP[ch] || ch);
    s = s.replace(/[^a-z0-9çğıöşü]/g, ''); // boşluk/noktalama/özel karakterleri tamamen at
    s = s.replace(/(.)\1{2,}/g, '$1'); // "kkkufuur" gibi 3+ tekrarları teke indir
    return s;
}

function getAutomodSettings(guildId) {
    const settings = getSettings(guildId);
    return settings.automod || {
        enabled: false,
        bannedWords: [],
        blockInvites: false,
        spamCount: 5,
        spamSeconds: 5
    };
}

function setAutomodSettings(guildId, patch) {
    const current = getAutomodSettings(guildId);
    const updated = { ...current, ...patch };
    setSettings(guildId, { automod: updated });
    return updated;
}

function checkSpam(guildId, userId, spamCount, spamSeconds) {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const windowMs = spamSeconds * 1000;

    let timestamps = recentMessages.get(key) || [];
    timestamps = timestamps.filter(t => now - t < windowMs);
    timestamps.push(now);
    recentMessages.set(key, timestamps);

    return timestamps.length > spamCount;
}

// Bir mesajı otomod kurallarına göre denetler. İhlal yoksa null, varsa {reason, action} döner.
function inspectMessage(message) {
    const settings = getAutomodSettings(message.guild.id);
    if (!settings.enabled) return null;

    // Yöneticiler / Mesajları Yönet yetkisine sahip olanlar otomod'dan muaftır
    if (message.member.permissions.has(PermissionFlagsBits.Administrator) || message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return null;
    }

    const content = message.content || '';
    const lower = normalizeForFilter(content);

    if (settings.blockInvites && INVITE_REGEX.test(content)) {
        return { reason: 'Discord davet linki paylaşımı yasak.', type: 'invite' };
    }

    if (settings.bannedWords && settings.bannedWords.length > 0) {
        const strippedContent = stripForBypassCheck(content);
        const hit = settings.bannedWords.find(w =>
            containsWholeWord(lower, normalizeForFilter(w)) ||
            stripForBypassCheck(w).length >= 3 && strippedContent.includes(stripForBypassCheck(w))
        );
        if (hit) return { reason: `Yasaklı kelime kullanımı: "${hit}"`, type: 'word' };
    }

    if (settings.spamCount && settings.spamSeconds) {
        if (checkSpam(message.guild.id, message.author.id, settings.spamCount, settings.spamSeconds)) {
            return { reason: `${settings.spamSeconds} saniyede ${settings.spamCount}'den fazla mesaj (spam).`, type: 'spam' };
        }
    }

    return null;
}

module.exports = { getAutomodSettings, setAutomodSettings, inspectMessage };
