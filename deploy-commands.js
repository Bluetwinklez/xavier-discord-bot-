require('dotenv').config({ override: true });
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'src/commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const stat = fs.statSync(folderPath);

    if (stat.isDirectory()) {
        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            try {
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    commands.push(command.data.toJSON());
                    console.log(`[Komut Yüklendi] ${command.data.name}`);
                } else {
                    console.warn(`[UYARI] ${filePath} dosyasında 'data' veya 'execute' özelliği eksik.`);
                }
            } catch (err) {
                console.error(`[HATA] ${filePath} yüklenemedi, atlanıyor:`, err.message);
            }
        }
    }
}

const token = process.env.DISCORD_TOKEN;
let clientId = process.env.CLIENT_ID;

if (!token || token === 'BURAYA_BOT_TOKENINI_YAPISTIRIN') {
    console.error('❌ Hata: .env dosyasında DISCORD_TOKEN tanımlanmamış!');
    process.exit(1);
}

if (!clientId || clientId === 'BURAYA_BOT_CLIENT_ID_YAPISTIRIN') {
    try {
        clientId = Buffer.from(token.split('.')[0], 'base64').toString('utf-8');
    } catch (_) {}
}

if (!clientId) {
    console.error('❌ Hata: .env dosyasında CLIENT_ID tanımlanmamış ve token üzerinden çıkarılamadı!');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

// Botun bulunduğu sunucular:
const TARGET_GUILDS = [
    '1249403005497774132', // Test Sunucusu
    '1537540277231947878', // tester-1
    '1075672494217908305'  // Latveria #DOOMSDAY
];

if (process.env.GUILD_ID && !TARGET_GUILDS.includes(process.env.GUILD_ID)) {
    TARGET_GUILDS.push(process.env.GUILD_ID);
}

(async () => {
    try {
        console.log(`\n⏳ ${commands.length} adet Slash (/) komutu Discord API'ye yükleniyor...`);

        // 1. Tüm sunuculara anında (0 saniye gecikmeyle) kaydet
        for (const gId of TARGET_GUILDS) {
            try {
                const data = await rest.put(
                    Routes.applicationGuildCommands(clientId, gId),
                    { body: commands }
                );
                console.log(`✅ ${data.length} komut [Sunucu ID: ${gId}] için ANINDA kaydedildi!`);
            } catch (err) {
                console.error(`❌ [Sunucu ID: ${gId}] için komutlar yüklenirken hata:`, err.message);
            }
        }

        // 2. Global olarak da kaydet
        try {
            const globalData = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands }
            );
            console.log(`🌐 ${globalData.length} komut GLOBAL olarak kaydedildi!`);
        } catch (err) {
            console.error('Global yükleme hatası:', err.message);
        }

    } catch (error) {
        console.error('❌ Komutlar yüklenirken genel bir hata oluştu:', error);
    } finally {
        process.exit(0);
    }
})();
