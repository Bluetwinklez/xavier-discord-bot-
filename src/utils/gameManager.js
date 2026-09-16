const { readJSON, writeJSON } = require('./fileStore');
const { addBalance } = require('./economyManager');

const FILE_NAME = 'games.json';

function getGameData(guildId) {
    const all = readJSON(FILE_NAME, {});
    if (!all[guildId]) {
        all[guildId] = {
            wordGame: { lastWord: 'elma', lastUserId: null, usedWords: ['elma'] },
            countingGame: { currentNumber: 0, lastUserId: null }
        };
        writeJSON(FILE_NAME, all);
    }
    return all[guildId];
}

function saveGameData(guildId, data) {
    const all = readJSON(FILE_NAME, {});
    all[guildId] = data;
    writeJSON(FILE_NAME, all);
}

async function handleWordGame(message, settings) {
    if (message.author.bot || !settings.wordGameChannelId) return false;
    if (message.channel.id !== settings.wordGameChannelId) return false;

    const word = message.content.trim().toLowerCase();
    // Tek bir Türkçe kelime olmalı (boşluk veya özel işaret yok)
    if (!/^[a-zçğıöşü]+$/i.test(word) || word.length < 2) {
        await message.react('❌').catch(() => {});
        return true;
    }

    const game = getGameData(message.guild.id);
    const wordState = game.wordGame;

    if (wordState.lastUserId === message.author.id) {
        await message.react('⚠️').catch(() => {});
        const msg = await message.reply('Üst üste iki kez kelime yazamazsın, başkasının yazmasını bekle!').catch(() => {});
        setTimeout(() => msg?.delete().catch(() => {}), 4000);
        return true;
    }

    const requiredLetter = wordState.lastWord.slice(-1);
    if (!word.startsWith(requiredLetter)) {
        await message.react('❌').catch(() => {});
        const msg = await message.reply(`Kelimen **"${requiredLetter.toUpperCase()}"** harfiyle başlamalıydı! *(Önceki: ${wordState.lastWord})*`).catch(() => {});
        setTimeout(() => msg?.delete().catch(() => {}), 4000);
        return true;
    }

    if (wordState.usedWords.includes(word)) {
        await message.react('❌').catch(() => {});
        const msg = await message.reply(`**"${word}"** kelimesi bu turda zaten kullanıldı! Başka bir kelime bul.`).catch(() => {});
        setTimeout(() => msg?.delete().catch(() => {}), 4000);
        return true;
    }

    // Başarılı!
    wordState.lastWord = word;
    wordState.lastUserId = message.author.id;
    wordState.usedWords.push(word);
    if (wordState.usedWords.length > 500) wordState.usedWords.shift();
    saveGameData(message.guild.id, game);

    await message.react('✅').catch(() => {});
    addBalance(message.guild.id, message.author.id, 5);
    return true;
}

async function handleCountingGame(message, settings) {
    if (message.author.bot || !settings.countingChannelId) return false;
    if (message.channel.id !== settings.countingChannelId) return false;

    const num = parseInt(message.content.trim());
    if (isNaN(num)) return true;

    const game = getGameData(message.guild.id);
    const countState = game.countingGame;

    if (countState.lastUserId === message.author.id) {
        await message.react('❌').catch(() => {});
        countState.currentNumber = 0;
        countState.lastUserId = null;
        saveGameData(message.guild.id, game);
        await message.channel.send(`💥 ${message.author} üst üste yazarak sayacı bozdu! Sayaç sıfırlandı. Sıradaki sayı: **1**`);
        return true;
    }

    const expected = countState.currentNumber + 1;
    if (num !== expected) {
        await message.react('❌').catch(() => {});
        countState.currentNumber = 0;
        countState.lastUserId = null;
        saveGameData(message.guild.id, game);
        await message.channel.send(`💥 ${message.author} yanlış sayı (**${num}**) yazarak sayacı bozdu! Doğru sayı: **${expected}** idi. Sayaç sıfırlandı. Sıradaki sayı: **1**`);
        return true;
    }

    // Doğru sayı
    countState.currentNumber = num;
    countState.lastUserId = message.author.id;
    saveGameData(message.guild.id, game);

    await message.react('✅').catch(() => {});

    // Her 25'lik kilometre taşında ödül ver
    if (num % 25 === 0) {
        await message.react('🎉').catch(() => {});
        addBalance(message.guild.id, message.author.id, 50);
        await message.channel.send(`🎯 **Tebrikler! ${num} sayısına ulaşıldı!** ${message.author} 50 💰 kazandı!`);
    }
    return true;
}

module.exports = { handleWordGame, handleCountingGame, getGameData };
