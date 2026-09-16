require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const logger = require('./src/utils/logger');
const { setMusicClient } = require('./src/utils/musicClient');

// Bot istemcisini gerekli Gateway Intent'leri ile başlatıyoruz
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,      // Karşılama ve oto-rol için gerekli
        GatewayIntentBits.GuildVoiceStates,  // Müzik çalma için ses durumu intent'i
        GatewayIntentBits.GuildModeration,   // Ban/unban log sistemi için gerekli
        GatewayIntentBits.GuildMessageReactions // Starboard için gerekli
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.Reaction, Partials.User]
});

// Komut koleksiyonunu oluşturuyoruz
client.commands = new Collection();

// 1. Komutları Yükleme (src/commands altındaki tüm klasörler)
const commandsPath = path.join(__dirname, 'src/commands');
if (fs.existsSync(commandsPath)) {
    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        if (fs.statSync(folderPath).isDirectory()) {
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path.join(folderPath, file);
                // require() burada senkron ve try/catch'siz olsaydı, TEK bir komut dosyasındaki
                // syntax hatası veya eksik bir modül (`Cannot find module`) tüm botun (100+ komut)
                // açılışını çökertirdi. Artık bozuk dosya sadece kendisi atlanarak loglanıyor.
                try {
                    const command = require(filePath);
                    if ('data' in command && 'execute' in command) {
                        client.commands.set(command.data.name, command);
                    } else {
                        console.warn(`[UYARI] ${filePath} dosyasında 'data' veya 'execute' eksik.`);
                    }
                } catch (err) {
                    console.error(`[HATA] ${filePath} yüklenemedi, atlanıyor:`, err.message);
                }
            }
        }
    }
}

// 2. Olayları (Events) Yükleme (src/events)
const eventsPath = path.join(__dirname, 'src/events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }
}

// Olası çöküşleri engellemek için hata yakalayıcılar
process.on('unhandledRejection', error => {
    logger.error('Yakalanmamış Promise Hatası (unhandledRejection):', error);
});

process.on('uncaughtException', error => {
    logger.error('Yakalanmamış Hata (uncaughtException):', error);
});

// Bot Girişi
const token = process.env.DISCORD_TOKEN;

if (!token || token === 'BURAYA_BOT_TOKENINI_YAPISTIRIN') {
    console.warn('\n⚠️  [DİKKAT] .env dosyasında DISCORD_TOKEN girilmemiş!');
    console.warn('👉 Lütfen .env dosyasını açıp Discord Developer Portal\'dan aldığınız Bot Token\'ı yapıştırın.\n');
    process.exit(0);
} else {
    client.login(token).catch(err => {
        console.error('❌ Bot giriş yaparken hata ile karşılaştı:', err.message);
    });
}

// İkinci (Müzik) Bot Girişi — opsiyonel. Ayarlanmışsa müzik sistemi bu ayrı bota taşınır,
// böylece ana bot sesle-komut/radyo/TTS için AYNI ANDA farklı bir ses bağlantısı kullanabilir.
// Ayarlanmamışsa musicManager.js otomatik olarak ana botu (fallback) kullanır.
const musicBotToken = process.env.MUSIC_BOT_TOKEN;
if (musicBotToken) {
    const musicClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates
        ]
    });

    musicClient.once('clientReady', () => {
        logger.info(`🎵 Müzik botu giriş yaptı: ${musicClient.user.tag}`);
        setMusicClient(musicClient);
    });

    musicClient.login(musicBotToken).catch(err => {
        logger.error('❌ Müzik botu giriş yaparken hata ile karşılaştı:', err);
    });
}
