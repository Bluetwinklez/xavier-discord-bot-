const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getSettings, setSettings } = require('./database');
const { createBackup } = require('./backupManager');

// AI'nin ürettiği tema JSON'u (bkz. tema-ai-olustur.js) burada TÜKETİLMEDEN önce hiç
// doğrulanmıyordu. "Sıfırla ve Kur" seçilirse önce TÜM kanallar silinir, sonra bu bozuk veriyle
// rol/kanal oluşturma denenirdi — malformed bir alan (yanlış tip, eksik dizi, sınır dışı değer)
// oluşturma sırasında Discord API'sinden hata aldırıp işlemi yarım bırakabiliyordu; kanallar zaten
// silinmiş, geri dönüş yoktu. Şimdi wipe/oluşturma başlamadan önce şema kontrol ediliyor.
function validateThemeSchema(theme) {
    if (!theme || typeof theme !== 'object') return { valid: false, error: 'Tema verisi bir obje değil.' };
    if (typeof theme.name !== 'string' || !theme.name.trim()) return { valid: false, error: 'Tema adı eksik.' };
    if (!Array.isArray(theme.roles)) return { valid: false, error: 'roles bir dizi değil.' };
    for (const r of theme.roles) {
        if (typeof r?.name !== 'string' || !r.name.trim() || r.name.length > 100) {
            return { valid: false, error: `Geçersiz rol adı: ${JSON.stringify(r?.name)}` };
        }
        if (r.color !== undefined && (typeof r.color !== 'number' || r.color < 0 || r.color > 0xFFFFFF)) {
            return { valid: false, error: `Geçersiz rol rengi: ${JSON.stringify(r.color)}` };
        }
    }
    if (!Array.isArray(theme.categories) || theme.categories.length === 0) {
        return { valid: false, error: 'categories eksik veya boş.' };
    }
    for (const cat of theme.categories) {
        if (typeof cat?.name !== 'string' || !cat.name.trim() || cat.name.length > 100) {
            return { valid: false, error: `Geçersiz kategori adı: ${JSON.stringify(cat?.name)}` };
        }
        if (!Array.isArray(cat.channels)) {
            return { valid: false, error: `"${cat.name}" kategorisinde channels bir dizi değil.` };
        }
        for (const ch of cat.channels) {
            if (typeof ch?.name !== 'string' || !ch.name.trim() || ch.name.length > 100) {
                return { valid: false, error: `Geçersiz kanal adı: ${JSON.stringify(ch?.name)}` };
            }
            if (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildVoice) {
                return { valid: false, error: `Geçersiz kanal tipi (0=metin, 2=ses olmalı): ${JSON.stringify(ch.type)}` };
            }
        }
    }
    return { valid: true };
}

const THEMES = {
    gaming: {
        id: 'gaming',
        name: '🎮 Gaming & Espor Topluluğu',
        description: 'Valorant, LoL, CS2, Minecraft gibi oyun odaları, limitli Duo/Squad ses kanalları ve oyuncu arama sistemi.',
        color: 0x5865F2,
        roles: [
            { name: '🛡️ Yönetici', color: 0xE74C3C, permissions: [PermissionFlagsBits.Administrator] },
            { name: '⚔️ Moderatör', color: 0xE67E22, permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers] },
            { name: '🌟 VIP Oyuncu', color: 0x9B59B6 },
            { name: '🎮 Gamer', color: 0x2ECC71 },
            { name: '🎯 Valorant', color: 0xFD4556 },
            { name: '⚔️ LoL', color: 0x0AC8B9 },
            { name: '💣 CS2', color: 0xDE9B35 },
            { name: '⛏️ Minecraft', color: 0x5B8731 },
            { name: '👥 Üye', color: 0x3498DB }
        ],
        categories: [
            {
                name: '📢 │ BİLGİ & DUYURU',
                channels: [
                    { name: '📜│kurallar', type: ChannelType.GuildText, readonly: true },
                    { name: '📢│duyurular', type: ChannelType.GuildText, readonly: true },
                    { name: '🎉│etkinlik-ve-cekilis', type: ChannelType.GuildText, readonly: true },
                    { name: '👋│hos-geldin', type: ChannelType.GuildText, readonly: true, isWelcome: true }
                ]
            },
            {
                name: '💬 │ TOPLULUK & SOHBET',
                channels: [
                    { name: '💬│genel-sohbet', type: ChannelType.GuildText },
                    { name: '🤖│bot-komut', type: ChannelType.GuildText },
                    { name: '📷│klipler-ve-ss', type: ChannelType.GuildText },
                    { name: '🔍│oyuncu-ara-lfg', type: ChannelType.GuildText }
                ]
            },
            {
                name: '🎮 │ OYUN ODALARI',
                channels: [
                    { name: '🎯│valorant', type: ChannelType.GuildText },
                    { name: '⚔️│lol', type: ChannelType.GuildText },
                    { name: '💣│cs2', type: ChannelType.GuildText },
                    { name: '⛏️│minecraft', type: ChannelType.GuildText }
                ]
            },
            {
                name: '🎫 │ DESTEK MERKEZİ',
                isTicketCategory: true,
                channels: [
                    { name: '🎫│destek-talebi', type: ChannelType.GuildText, readonly: true, isTicket: true }
                ]
            },
            {
                name: '🔊 │ SES KANALLARI',
                channels: [
                    { name: '➕ │ Oda Oluştur', type: ChannelType.GuildVoice, userLimit: 1, isTempHub: true },
                    { name: '🔊 │ Sohbet Odası 1', type: ChannelType.GuildVoice },
                    { name: '🔊 │ Sohbet Odası 2', type: ChannelType.GuildVoice },
                    { name: '🎵 │ Müzik Odası', type: ChannelType.GuildVoice },
                    { name: '🎮 │ Duo Odası 1 (2P)', type: ChannelType.GuildVoice, userLimit: 2 },
                    { name: '🎮 │ Duo Odası 2 (2P)', type: ChannelType.GuildVoice, userLimit: 2 },
                    { name: '🎮 │ Squad Odası (5P)', type: ChannelType.GuildVoice, userLimit: 5 },
                    { name: '💤 │ AFK', type: ChannelType.GuildVoice }
                ]
            }
        ]
    },
    dev: {
        id: 'dev',
        name: '💻 Yazılım & Geliştirici Topluluğu',
        description: 'Programlama dilleri, kod yardımı, proje inceleme, GitHub paylaşımları ve sessiz kodlama ses odaları.',
        color: 0x00D2D3,
        roles: [
            { name: '⚡ Tech Lead', color: 0xE74C3C, permissions: [PermissionFlagsBits.Administrator] },
            { name: '🛡️ Moderatör', color: 0xE67E22, permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers] },
            { name: '🚀 Senior Dev', color: 0x9B59B6 },
            { name: '🐍 Python', color: 0x3776AB },
            { name: '🟨 JavaScript/TS', color: 0xF7DF1E },
            { name: '📱 Mobile (Flutter/Swift)', color: 0x02569B },
            { name: '🤖 AI / ML', color: 0xFF6F61 },
            { name: '💻 Yazılımcı', color: 0x2ECC71 },
            { name: '👥 Üye', color: 0x3498DB }
        ],
        categories: [
            {
                name: '📢 │ DUYURU & BİLGİ',
                channels: [
                    { name: '📜│kurallar', type: ChannelType.GuildText, readonly: true },
                    { name: '📢│duyurular', type: ChannelType.GuildText, readonly: true },
                    { name: '👋│yeni-katilanlar', type: ChannelType.GuildText, readonly: true, isWelcome: true }
                ]
            },
            {
                name: '💬 │ GENEL & PAYLAŞIM',
                channels: [
                    { name: '💬│developer-sohbet', type: ChannelType.GuildText },
                    { name: '🚀│proje-vitrini', type: ChannelType.GuildText },
                    { name: '📚│kaynak-ve-kitaplar', type: ChannelType.GuildText },
                    { name: '💼│is-ve-staj-ilanlari', type: ChannelType.GuildText }
                ]
            },
            {
                name: '🛠️ │ YAZILIM DİLLERİ & YARDIM',
                channels: [
                    { name: '🐍│python', type: ChannelType.GuildText },
                    { name: '🌐│web-ve-javascript', type: ChannelType.GuildText },
                    { name: '⚙️│c-cpp-csharp', type: ChannelType.GuildText },
                    { name: '🤖│yapay-zeka-llm', type: ChannelType.GuildText },
                    { name: '❓│kod-yardim-ve-hata', type: ChannelType.GuildText }
                ]
            },
            {
                name: '🎫 │ DESTEK & TALEP',
                isTicketCategory: true,
                channels: [
                    { name: '🎫│destek-talebi', type: ChannelType.GuildText, readonly: true, isTicket: true }
                ]
            },
            {
                name: '🔊 │ ÇALIŞMA VE SES ODALARI',
                channels: [
                    { name: '➕ │ Oda Oluştur', type: ChannelType.GuildVoice, userLimit: 1, isTempHub: true },
                    { name: '🎧 │ Sessiz Kodlama 1', type: ChannelType.GuildVoice },
                    { name: '🎧 │ Sessiz Kodlama 2', type: ChannelType.GuildVoice },
                    { name: '💡 │ Beyin Fırtınası', type: ChannelType.GuildVoice },
                    { name: '🎵 │ Lo-Fi Müzik Odası', type: ChannelType.GuildVoice }
                ]
            }
        ]
    },
    chill: {
        id: 'chill',
        name: '☕ Chill, Kafe & Sohbet Topluluğu',
        description: 'Sıcak ve samimi muhabbet, günlük yaşam, müzik dinleme, film/dizi gecesi ve kahve köşesi ses odaları.',
        color: 0xE67E22,
        roles: [
            { name: '👑 Kafe Sahibi', color: 0xF1C40F, permissions: [PermissionFlagsBits.Administrator] },
            { name: '🛡️ Barista (Mod)', color: 0xE67E22, permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers] },
            { name: '🌟 Müdavim (VIP)', color: 0x9B59B6 },
            { name: '☕ Kahvesever', color: 0x795548 },
            { name: '🎵 Müziksever', color: 0xE91E63 },
            { name: '👥 Misafir (Üye)', color: 0x3498DB }
        ],
        categories: [
            {
                name: '☕ │ KAFE REHBERİ',
                channels: [
                    { name: '📜│kafe-kurallari', type: ChannelType.GuildText, readonly: true },
                    { name: '📢│kafe-bulteni', type: ChannelType.GuildText, readonly: true },
                    { name: '👋│hos-geldiniz', type: ChannelType.GuildText, readonly: true, isWelcome: true }
                ]
            },
            {
                name: '💬 │ SOHBET KÖŞESİ',
                channels: [
                    { name: '💬│genel-sohbet', type: ChannelType.GuildText },
                    { name: '📸│gunluk-ve-fotolar', type: ChannelType.GuildText },
                    { name: '🎬│film-dizi-kitap', type: ChannelType.GuildText },
                    { name: '🎵│sarki-onerileri', type: ChannelType.GuildText },
                    { name: '🤖│bot-komut', type: ChannelType.GuildText }
                ]
            },
            {
                name: '🎫 │ DESTEK & ÖNERİ',
                isTicketCategory: true,
                channels: [
                    { name: '🎫│oneri-ve-destek', type: ChannelType.GuildText, readonly: true, isTicket: true }
                ]
            },
            {
                name: '🔊 │ KAFE MASALARI (SES)',
                channels: [
                    { name: '➕ │ Masa Aç', type: ChannelType.GuildVoice, userLimit: 1, isTempHub: true },
                    { name: '☕ │ 1 Nolu Masa (Sohbet)', type: ChannelType.GuildVoice },
                    { name: '☕ │ 2 Nolu Masa (Sohbet)', type: ChannelType.GuildVoice },
                    { name: '🎵 │ Kafe Radyosu (Müzik)', type: ChannelType.GuildVoice },
                    { name: '🎬 │ Sinema Salonu', type: ChannelType.GuildVoice, userLimit: 15 },
                    { name: '💤 │ Dinlenme Alanı', type: ChannelType.GuildVoice }
                ]
            }
        ]
    },
    anime: {
        id: 'anime',
        name: '🎌 Anime, Manga & Kültür Topluluğu',
        description: 'Sezonluk anime tartışmaları, manga önerileri, cosplay, Japonca ve fan art paylaşım kanalları.',
        color: 0xFF7675,
        roles: [
            { name: '👑 Hokage (Admin)', color: 0xD63031, permissions: [PermissionFlagsBits.Administrator] },
            { name: '⚔️ Shinobi (Mod)', color: 0xE17055, permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers] },
            { name: '🌟 Senpai (VIP)', color: 0xFD79A8 },
            { name: '🎨 Sanatçı / Çizer', color: 0x0984E3 },
            { name: '📖 Mangasever', color: 0x6C5CE7 },
            { name: '🌸 Otaku (Üye)', color: 0x00CEC9 }
        ],
        categories: [
            {
                name: '🎌 │ BİLGİ & GİRİŞ',
                channels: [
                    { name: '📜│kurallar', type: ChannelType.GuildText, readonly: true },
                    { name: '📢│duyurular', type: ChannelType.GuildText, readonly: true },
                    { name: '👋│hos-geldin-senpai', type: ChannelType.GuildText, readonly: true, isWelcome: true }
                ]
            },
            {
                name: '💬 │ GENEL & ANİME',
                channels: [
                    { name: '💬│anime-sohbet', type: ChannelType.GuildText },
                    { name: '📺│sezonluk-animeler', type: ChannelType.GuildText },
                    { name: '📖│manga-ve-webtoon', type: ChannelType.GuildText },
                    { name: '⚠️│spoiler-alani', type: ChannelType.GuildText },
                    { name: '🎨│fan-art-ve-cizim', type: ChannelType.GuildText }
                ]
            },
            {
                name: '🎫 │ DESTEK MERKEZİ',
                isTicketCategory: true,
                channels: [
                    { name: '🎫│destek-talebi', type: ChannelType.GuildText, readonly: true, isTicket: true }
                ]
            },
            {
                name: '🔊 │ SES ODALARI',
                channels: [
                    { name: '➕ │ Oda Oluştur', type: ChannelType.GuildVoice, userLimit: 1, isTempHub: true },
                    { name: '🔊 │ Anime Sohbet 1', type: ChannelType.GuildVoice },
                    { name: '🔊 │ Anime Sohbet 2', type: ChannelType.GuildVoice },
                    { name: '🎵 │ J-Pop & Anime OST', type: ChannelType.GuildVoice },
                    { name: '🎬 │ Anime Birlikte İzleme', type: ChannelType.GuildVoice, userLimit: 10 }
                ]
            }
        ]
    },
    study: {
        id: 'study',
        name: '📚 Ders Çalışma & Pomodoro Kütüphanesi',
        description: 'Sessiz kütüphane odaları, Pomodoro seansları, YKS/Üniversite/KPSS çalışma grupları ve soru çözümü.',
        color: 0x6C5CE7,
        roles: [
            { name: '🎓 Kütüphane Yöneticisi', color: 0x2D3436, permissions: [PermissionFlagsBits.Administrator] },
            { name: '🛡️ Nöbetçi (Mod)', color: 0x0984E3, permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers] },
            { name: '⭐ Derece Öğrencisi', color: 0xFDCB6E },
            { name: '📖 YKS / Üniversite', color: 0x00B894 },
            { name: '🎯 KPSS / ALES', color: 0xE17055 },
            { name: '📚 Öğrenci (Üye)', color: 0x74B9FF }
        ],
        categories: [
            {
                name: '🏛️ │ KÜTÜPHANE BİLGİ',
                channels: [
                    { name: '📜│calisma-kurallari', type: ChannelType.GuildText, readonly: true },
                    { name: '📢│kutuphane-duyurulari', type: ChannelType.GuildText, readonly: true },
                    { name: '👋│yeni-ogrenciler', type: ChannelType.GuildText, readonly: true, isWelcome: true }
                ]
            },
            {
                name: '✏️ │ DERS & SORU PAYLAŞIMI',
                channels: [
                    { name: '💬│mola-alani-sohbet', type: ChannelType.GuildText },
                    { name: '❓│soru-cozumu-yardim', type: ChannelType.GuildText },
                    { name: '📚│kaynak-pdf-arşivi', type: ChannelType.GuildText },
                    { name: '🎯│gunluk-hedef-ve-takip', type: ChannelType.GuildText }
                ]
            },
            {
                name: '🎫 │ DESTEK & ÖNERİ',
                isTicketCategory: true,
                channels: [
                    { name: '🎫│destek-talebi', type: ChannelType.GuildText, readonly: true, isTicket: true }
                ]
            },
            {
                name: '🔊 │ SESSİZ KÜTÜPHANE (SES)',
                channels: [
                    { name: '➕ │ Özel Masa Aç', type: ChannelType.GuildVoice, userLimit: 1, isTempHub: true },
                    { name: '🤫 │ Sessiz Salon 1 (Mics Muted)', type: ChannelType.GuildVoice },
                    { name: '🤫 │ Sessiz Salon 2 (Mics Muted)', type: ChannelType.GuildVoice },
                    { name: '🍅 │ Pomodoro Seansı (50/10)', type: ChannelType.GuildVoice },
                    { name: '👥 │ Birlikte Soru Çözümü', type: ChannelType.GuildVoice, userLimit: 6 },
                    { name: '☕ │ Mola Odası', type: ChannelType.GuildVoice }
                ]
            }
        ]
    },
    design: {
        id: 'design',
        name: '🎨 Tasarım & Dijital Sanat Topluluğu',
        description: 'UI/UX, 3D Modelleme & Blender, illüstrasyon, portfolyo inceleme ve freelance iş olanakları.',
        color: 0xFD79A8,
        roles: [
            { name: '👑 Art Director', color: 0xD63031, permissions: [PermissionFlagsBits.Administrator] },
            { name: '🛡️ Moderatör', color: 0xE67E22, permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers] },
            { name: '🌟 Master Designer', color: 0x9B59B6 },
            { name: '📐 UI/UX Designer', color: 0x0984E3 },
            { name: '🧊 3D / Blender Artist', color: 0xE17055 },
            { name: '🖌️ İllüstratör', color: 0x00CEC9 },
            { name: '🎨 Sanatçı (Üye)', color: 0xFD79A8 }
        ],
        categories: [
            {
                name: '🎨 │ STÜDYO REHBERİ',
                channels: [
                    { name: '📜│kurallar', type: ChannelType.GuildText, readonly: true },
                    { name: '📢│stüdyo-duyurulari', type: ChannelType.GuildText, readonly: true },
                    { name: '👋│hos-geldin-sanatci', type: ChannelType.GuildText, readonly: true, isWelcome: true }
                ]
            },
            {
                name: '🖼️ │ GALERİ & ÇALIŞMALAR',
                channels: [
                    { name: '💬│sanat-ve-tasarim-sohbet', type: ChannelType.GuildText },
                    { name: '✨│calisma-paylasimi', type: ChannelType.GuildText },
                    { name: '🔍│portfolyo-ve-feedback', type: ChannelType.GuildText },
                    { name: '💼│freelance-ve-is-ilanlari', type: ChannelType.GuildText },
                    { name: '📦│ucretsiz-asset-kaynak', type: ChannelType.GuildText }
                ]
            },
            {
                name: '🎫 │ DESTEK KANALI',
                isTicketCategory: true,
                channels: [
                    { name: '🎫│destek-talebi', type: ChannelType.GuildText, readonly: true, isTicket: true }
                ]
            },
            {
                name: '🔊 │ STÜDYO ODALARI (SES)',
                channels: [
                    { name: '➕ │ Oda Oluştur', type: ChannelType.GuildVoice, userLimit: 1, isTempHub: true },
                    { name: '🎨 │ Çizim & Tasarım Odası 1', type: ChannelType.GuildVoice },
                    { name: '🎨 │ Çizim & Tasarım Odası 2', type: ChannelType.GuildVoice },
                    { name: '🧊 │ 3D & Render Odası', type: ChannelType.GuildVoice },
                    { name: '🎵 │ İlham Veren Müzikler', type: ChannelType.GuildVoice }
                ]
            }
        ]
    },
    music: {
        id: 'music',
        name: '🎧 Müzik & DJ Topluluğu',
        description: 'Tür bazlı müzik sohbetleri, şarkı/prodüksiyon paylaşımı, canlı DJ seti ve dinleme partisi ses odaları.',
        color: 0x1DB954,
        roles: [
            { name: '👑 Baş DJ (Admin)', color: 0x1DB954, permissions: [PermissionFlagsBits.Administrator] },
            { name: '🛡️ Moderatör', color: 0xE67E22, permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers] },
            { name: '🎧 DJ / Prodüktör', color: 0xE91E63 },
            { name: '🎤 Sanatçı', color: 0x9B59B6 },
            { name: '🎼 Müzik Eleştirmeni', color: 0x3498DB },
            { name: '🎵 Dinleyici (Üye)', color: 0x2ECC71 }
        ],
        categories: [
            {
                name: '🎧 │ STÜDYO BİLGİ',
                channels: [
                    { name: '📜│kurallar', type: ChannelType.GuildText, readonly: true },
                    { name: '📢│duyurular', type: ChannelType.GuildText, readonly: true },
                    { name: '👋│hos-geldin', type: ChannelType.GuildText, readonly: true, isWelcome: true }
                ]
            },
            {
                name: '💬 │ MÜZİK SOHBETİ',
                channels: [
                    { name: '💬│genel-sohbet', type: ChannelType.GuildText },
                    { name: '🎵│sarki-onerileri', type: ChannelType.GuildText },
                    { name: '🎤│kendi-prodüksiyonun', type: ChannelType.GuildText },
                    { name: '🎨│kapak-ve-tasarim', type: ChannelType.GuildText },
                    { name: '🤖│bot-komut', type: ChannelType.GuildText }
                ]
            },
            {
                name: '🎫 │ DESTEK MERKEZİ',
                isTicketCategory: true,
                channels: [
                    { name: '🎫│destek-talebi', type: ChannelType.GuildText, readonly: true, isTicket: true }
                ]
            },
            {
                name: '🔊 │ SES ODALARI',
                channels: [
                    { name: '➕ │ Oda Oluştur', type: ChannelType.GuildVoice, userLimit: 1, isTempHub: true },
                    { name: '🎚️ │ Canlı DJ Seti', type: ChannelType.GuildVoice },
                    { name: '🎉 │ Dinleme Partisi', type: ChannelType.GuildVoice },
                    { name: '🎹 │ Prodüksiyon Odası', type: ChannelType.GuildVoice },
                    { name: '📻 │ Radyo Odası', type: ChannelType.GuildVoice },
                    { name: '💤 │ AFK', type: ChannelType.GuildVoice }
                ]
            }
        ]
    },
    crypto: {
        id: 'crypto',
        name: '💰 Kripto & Borsa Topluluğu',
        description: 'Coin analizleri, sinyal paylaşımı, portföy tartışması ve piyasa haberleri için tasarlanmış topluluk.',
        color: 0xF7931A,
        roles: [
            { name: '👑 Kurucu', color: 0xF7931A, permissions: [PermissionFlagsBits.Administrator] },
            { name: '🛡️ Moderatör', color: 0xE67E22, permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers] },
            { name: '📊 Analist', color: 0x9B59B6 },
            { name: '🐋 Balina (VIP)', color: 0x3498DB },
            { name: '🟠 Bitcoin Maksi', color: 0xF7931A },
            { name: '🔷 Altcoin Avcısı', color: 0x627EEA },
            { name: '👥 Yatırımcı (Üye)', color: 0x2ECC71 }
        ],
        categories: [
            {
                name: '📢 │ BİLGİ & DUYURU',
                channels: [
                    { name: '📜│kurallar', type: ChannelType.GuildText, readonly: true },
                    { name: '📢│duyurular', type: ChannelType.GuildText, readonly: true },
                    { name: '⚠️│yatirim-tavsiyesi-degildir', type: ChannelType.GuildText, readonly: true },
                    { name: '👋│hos-geldin', type: ChannelType.GuildText, readonly: true, isWelcome: true }
                ]
            },
            {
                name: '📊 │ PİYASA & ANALİZ',
                channels: [
                    { name: '💬│genel-sohbet', type: ChannelType.GuildText },
                    { name: '📰│piyasa-haberleri', type: ChannelType.GuildText },
                    { name: '📈│teknik-analiz', type: ChannelType.GuildText },
                    { name: '🟠│bitcoin', type: ChannelType.GuildText },
                    { name: '🔷│altcoinler', type: ChannelType.GuildText },
                    { name: '💼│portfoy-paylasimi', type: ChannelType.GuildText }
                ]
            },
            {
                name: '🎫 │ DESTEK MERKEZİ',
                isTicketCategory: true,
                channels: [
                    { name: '🎫│destek-talebi', type: ChannelType.GuildText, readonly: true, isTicket: true }
                ]
            },
            {
                name: '🔊 │ SES ODALARI',
                channels: [
                    { name: '➕ │ Oda Oluştur', type: ChannelType.GuildVoice, userLimit: 1, isTempHub: true },
                    { name: '📊 │ Piyasa Sohbeti', type: ChannelType.GuildVoice },
                    { name: '🎙️ │ Haftalık Analiz Yayını', type: ChannelType.GuildVoice },
                    { name: '💤 │ AFK', type: ChannelType.GuildVoice }
                ]
            }
        ]
    },
    sports: {
        id: 'sports',
        name: '⚽ Spor Topluluğu',
        description: 'Maç günü sohbeti, transfer haberleri, fantezi lig ve takım bazlı tartışma kanalları.',
        color: 0x27AE60,
        roles: [
            { name: '👑 Başkan', color: 0x27AE60, permissions: [PermissionFlagsBits.Administrator] },
            { name: '🛡️ Hakem (Mod)', color: 0xE67E22, permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers] },
            { name: '⭐ Efsane (VIP)', color: 0xF1C40F },
            { name: '⚽ Futbolsever', color: 0x2ECC71 },
            { name: '🏀 Basketbolsever', color: 0xE67E22 },
            { name: '🎮 Fantezi Lig Oyuncusu', color: 0x9B59B6 },
            { name: '👥 Taraftar (Üye)', color: 0x3498DB }
        ],
        categories: [
            {
                name: '📢 │ BİLGİ & DUYURU',
                channels: [
                    { name: '📜│kurallar', type: ChannelType.GuildText, readonly: true },
                    { name: '📢│duyurular', type: ChannelType.GuildText, readonly: true },
                    { name: '👋│hos-geldin', type: ChannelType.GuildText, readonly: true, isWelcome: true }
                ]
            },
            {
                name: '⚽ │ MAÇ GÜNÜ',
                channels: [
                    { name: '💬│genel-sohbet', type: ChannelType.GuildText },
                    { name: '📅│mac-programi', type: ChannelType.GuildText },
                    { name: '🔄│transfer-haberleri', type: ChannelType.GuildText },
                    { name: '🎮│fantezi-lig', type: ChannelType.GuildText },
                    { name: '📸│goller-ve-klipler', type: ChannelType.GuildText }
                ]
            },
            {
                name: '🎫 │ DESTEK & ÖNERİ',
                isTicketCategory: true,
                channels: [
                    { name: '🎫│destek-talebi', type: ChannelType.GuildText, readonly: true, isTicket: true }
                ]
            },
            {
                name: '🔊 │ TRİBÜN (SES)',
                channels: [
                    { name: '➕ │ Oda Oluştur', type: ChannelType.GuildVoice, userLimit: 1, isTempHub: true },
                    { name: '🎙️ │ Maç Anlatımı', type: ChannelType.GuildVoice },
                    { name: '🔊 │ Tribün Sohbeti 1', type: ChannelType.GuildVoice },
                    { name: '🔊 │ Tribün Sohbeti 2', type: ChannelType.GuildVoice },
                    { name: '💤 │ AFK', type: ChannelType.GuildVoice }
                ]
            }
        ]
    },
    roleplay: {
        id: 'roleplay',
        name: '🐉 Roleplay & Fantezi Topluluğu',
        description: 'Karakter oluşturma, hikaye anlatımı, lore paylaşımı ve canlı rol yapma seansları için kurulmuş topluluk.',
        color: 0x8E44AD,
        roles: [
            { name: '👑 Dünya Ustası (Admin)', color: 0x8E44AD, permissions: [PermissionFlagsBits.Administrator] },
            { name: '🛡️ Anlatıcı (Mod)', color: 0xE67E22, permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers] },
            { name: '🌟 Usta Oyuncu (VIP)', color: 0xF1C40F },
            { name: '🐉 Ejderha Klanı', color: 0xE74C3C },
            { name: '🧝 Elf Klanı', color: 0x2ECC71 },
            { name: '🗡️ Maceracı (Üye)', color: 0x3498DB }
        ],
        categories: [
            {
                name: '📜 │ LORE & KURALLAR',
                channels: [
                    { name: '📜│kurallar', type: ChannelType.GuildText, readonly: true },
                    { name: '📖│dunya-lore', type: ChannelType.GuildText, readonly: true },
                    { name: '📢│duyurular', type: ChannelType.GuildText, readonly: true },
                    { name: '👋│hos-geldin-maceraci', type: ChannelType.GuildText, readonly: true, isWelcome: true }
                ]
            },
            {
                name: '⚔️ │ HİKAYE & SOHBET',
                channels: [
                    { name: '💬│ooc-genel-sohbet', type: ChannelType.GuildText },
                    { name: '🧙│karakter-olustur', type: ChannelType.GuildText },
                    { name: '📖│hikaye-anlatimi-ic', type: ChannelType.GuildText },
                    { name: '🎨│karakter-sanati', type: ChannelType.GuildText }
                ]
            },
            {
                name: '🎫 │ DESTEK MERKEZİ',
                isTicketCategory: true,
                channels: [
                    { name: '🎫│destek-talebi', type: ChannelType.GuildText, readonly: true, isTicket: true }
                ]
            },
            {
                name: '🔊 │ MACERA ODALARI (SES)',
                channels: [
                    { name: '➕ │ Oda Oluştur', type: ChannelType.GuildVoice, userLimit: 1, isTempHub: true },
                    { name: '🎭 │ Canlı RP Seansı 1', type: ChannelType.GuildVoice },
                    { name: '🎭 │ Canlı RP Seansı 2', type: ChannelType.GuildVoice },
                    { name: '🎲 │ Masaüstü Oyun Masası', type: ChannelType.GuildVoice, userLimit: 6 },
                    { name: '💤 │ AFK', type: ChannelType.GuildVoice }
                ]
            }
        ]
    }
};

function getThemePreviewEmbed(theme) {
    const embed = new EmbedBuilder()
        .setColor(theme.color)
        .setTitle(`📋 TEMA ÖNİZLEMESİ: ${theme.name}`)
        .setDescription(`**Açıklama:** ${theme.description}\n\n*Aşağıda bu tema kurulduğunda açılacak kanalların ve oluşturulacak rollerin tam listesi yer almaktadır:*`);

    // Rolleri listele
    const rolesList = theme.roles.map(r => `• ${r.name}`).join('\n');
    embed.addFields({ name: '🎭 Oluşturulacak Roller', value: rolesList || 'Yok' });

    // Kategoriler ve Kanalları ağaç şeklinde listele
    for (const cat of theme.categories) {
        const channelList = cat.channels.map(c => {
            const icon = c.type === ChannelType.GuildVoice ? '🔊' : '#';
            const limit = c.userLimit ? ` *(Limit: ${c.userLimit})*` : '';
            return `  └ ${icon} \`${c.name}\`${limit}`;
        }).join('\n');

        embed.addFields({
            name: `📁 ${cat.name}`,
            value: channelList || 'Kanal yok'
        });
    }

    embed.setFooter({ text: 'Onaylamak için aşağıdaki yeşil butona basınız. İptal etmek için kırmızı butona basınız.' })
        .setTimestamp();

    return embed;
}

async function applyThemeToGuild(guild, theme, interaction, wipeExisting = false) {
    const schemaCheck = validateThemeSchema(theme);
    if (!schemaCheck.valid) {
        await interaction.editReply({
            content: `❌ Tema verisi geçersiz olduğu için işlem GÜVENLİK GEREĞİ durduruldu (hiçbir kanal silinmedi): ${schemaCheck.error}`,
            embeds: [],
            components: []
        });
        return;
    }

    const createdRoles = {};
    const settingsUpdate = {};

    if (wipeExisting) {
        // Yıkıcı işlemden hemen önce otomatik yedek al — eskiden bu yoktu, bir şey ters giderse
        // (ör. Discord API rate limit'e takılıp yarım kalırsa) geri dönüş imkânı hiç yoktu.
        let autoBackupId = null;
        try {
            autoBackupId = createBackup(guild).id;
        } catch (err) {
            console.error('Tema kurulumu öncesi otomatik yedek alınamadı:', err);
        }

        await interaction.editReply({
            content: `🚨 **[0/4] Sunucudaki mevcut kanallar temizleniyor...** Lütfen bekleyin.` +
                (autoBackupId ? `\n💾 Güvenlik için otomatik yedek alındı (ID: \`${autoBackupId}\`) — bir şeyler ters giderse \`/yedek-geri-yukle yedek-id:${autoBackupId}\` ile rol/kanalları geri getirebilirsiniz.` : ''),
            embeds: [],
            components: []
        });

        // AI sohbet kanalı KORUNUR: bot bu kanalı kendiliğinden asla silmez, sadece Yönetici
        // Discord üzerinden elle silerse kaldırılır. Sıfırlama sırasında da hariç tutulur.
        const protectedAiChannelId = getSettings(guild.id).aiChannelId;

        // Tüm diğer kanallar silineceği için, eski kanal ID'lerine referans veren ayarlar artık
        // geçersiz olacak. Tema kurulumu bunlardan bir kısmını (welcome/ticket/tempHub) yeniden
        // set edecek olsa da, temizlenmezse silinen bir kanalı işaret etmeye devam ederler.
        setSettings(guild.id, {
            ticketCategoryId: null,
            welcomeChannelId: null,
            tempVoiceHubId: null
        });

        // Mevcut kanalları al (işlem yapılan kanalı ve AI kanalını hariç tut)
        const channelsToDelete = guild.channels.cache.filter(c =>
            c.id !== interaction.channelId && c.id !== protectedAiChannelId
        );
        for (const [, ch] of channelsToDelete) {
            try {
                await ch.delete('Sunucu sıfırlama ve tema kurulumu');
            } catch (err) {
                console.warn(`Kanal silinemedi (${ch.name}):`, err.message);
            }
        }
    }

    await interaction.editReply({ content: `⏳ **[1/4]** \`${theme.name}\` rolleri oluşturuluyor...`, embeds: [], components: [] });

    // 1. Rolleri oluştur
    for (const r of theme.roles) {
        let role = guild.roles.cache.find(roleItem => roleItem.name === r.name);
        if (!role) {
            role = await guild.roles.create({
                name: r.name,
                color: r.color,
                permissions: r.permissions || [],
                hoist: true,
                reason: `${theme.name} teması kurulumu`
            });
        }
        createdRoles[r.name] = role;
    }

    // Üye rolünü bul
    const memberRole = Object.values(createdRoles).find(r => r.name.includes('Üye') || r.name.includes('Misafir') || r.name.includes('Otaku') || r.name.includes('Öğrenci') || r.name.includes('Sanatçı'));
    if (memberRole) {
        settingsUpdate.autoRoleId = memberRole.id;
    }

    await interaction.editReply({ content: `⏳ **[2/4]** Kategoriler ve kanallar inşa ediliyor...` });

    // 2. Kategorileri ve Kanalları Oluştur
    for (const cat of theme.categories) {
        const categoryChannel = await guild.channels.create({
            name: cat.name,
            type: ChannelType.GuildCategory
        });

        if (cat.isTicketCategory) {
            settingsUpdate.ticketCategoryId = categoryChannel.id;
        }

        for (const ch of cat.channels) {
            const overwrites = [];
            if (ch.readonly) {
                overwrites.push({ id: guild.id, deny: [PermissionFlagsBits.SendMessages] });
            }

            const createdChannel = await guild.channels.create({
                name: ch.name,
                type: ch.type,
                parent: categoryChannel.id,
                userLimit: ch.userLimit || 0,
                permissionOverwrites: overwrites
            });

            if (ch.isWelcome) {
                settingsUpdate.welcomeChannelId = createdChannel.id;
            }

            if (ch.isTempHub) {
                settingsUpdate.tempVoiceHubId = createdChannel.id;
            }

            if (ch.isTicket) {
                const ticketEmbed = new EmbedBuilder()
                    .setColor(theme.color)
                    .setTitle(`🎫 ${theme.name} Destek Sistemi`)
                    .setDescription('Yetkili ekibimizle özel olarak görüşmek veya yardım talep etmek için aşağıdaki butona tıklayınız.')
                    .setFooter({ text: 'Gereksiz yere talep açılması ceza sebebidir.' });

                const ticketRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('open_ticket')
                        .setLabel('Destek Talebi Aç')
                        .setEmoji('📩')
                        .setStyle(ButtonStyle.Primary)
                );

                await createdChannel.send({ embeds: [ticketEmbed], components: [ticketRow] }).catch(() => {});
            }
        }
    }

    await interaction.editReply({ content: `⏳ **[3/4]** Bot ayarları hafızaya kaydediliyor...` });
    setSettings(guild.id, settingsUpdate);

    const successEmbed = new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle(`🎉 ${theme.name} Kurulumu Tamamlandı!`)
        .setDescription(`Sunucunuz başarıyla **${theme.name}** temasına göre yapılandırıldı! Tüm kanallar, roller, geçici ses odaları ve destek paneli hazırlandı.`)
        .addFields(
            { name: '✨ Kurulan Tema', value: theme.name, inline: true },
            { name: '📁 Kategori Sayısı', value: `${theme.categories.length} adet`, inline: true },
            { name: '🎭 Rol Sayısı', value: `${theme.roles.length} adet`, inline: true }
        )
        .setFooter({ text: 'Discord.js v14 Tema Yöneticisi' })
        .setTimestamp();

    await interaction.editReply({ content: null, embeds: [successEmbed], components: [] });

    // Not: İşlemin başlatıldığı kanal (ör. AI kanalı) kasıtlı olarak silinmiyor.
    // Sıfırlama sırasında zaten diğer tüm kanallardan farklı olarak korunuyordu (bkz. yukarısı),
    // eskiden 5sn sonra ayrıca siliniyordu — bu davranış kaldırıldı çünkü kalıcı olması gereken
    // kanalları (özellikle AI sohbet kanalını) istenmeden yok ediyordu.
}

const customThemes = new Map(); // id -> themeObject

module.exports = {
    THEMES,
    customThemes,
    getThemePreviewEmbed,
    applyThemeToGuild,
    validateThemeSchema
};
