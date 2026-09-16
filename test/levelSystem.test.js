const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.BOT_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'botdata-test-'));
const { writeJSON } = require('../src/utils/fileStore');
const levelSystem = require('../src/utils/levelSystem');

const GUILD = 'g1';

test('xpForLevel formülü (5*level^2 + 50*level + 100) doğru hesaplar', () => {
    assert.equal(levelSystem.xpForLevel(0), 100);
    assert.equal(levelSystem.xpForLevel(1), 155);
    assert.equal(levelSystem.xpForLevel(5), 475);
});

test('addXp yeni kullanıcıya 15-25 arası XP verir, seviye atlamaz', () => {
    const newLevel = levelSystem.addXp(GUILD, 'u-yeni');
    assert.equal(newLevel, null); // 100 XP eşiğinin çok altında, level up olmaz

    const rank = levelSystem.getRank(GUILD, 'u-yeni');
    assert.ok(rank.xp >= 15 && rank.xp <= 25);
    assert.equal(rank.level, 0);
});

test('addXp aynı kullanıcı için 60sn cooldown içinde tekrar XP vermez', () => {
    const userId = 'u-cooldown';
    const first = levelSystem.addXp(GUILD, userId);
    assert.notEqual(first, undefined); // ilk çağrı her zaman işler (null veya seviye numarası)

    const rankAfterFirst = levelSystem.getRank(GUILD, userId);
    const second = levelSystem.addXp(GUILD, userId); // hemen tekrar çağrılıyor, cooldown'da olmalı
    assert.equal(second, null);

    const rankAfterSecond = levelSystem.getRank(GUILD, userId);
    assert.equal(rankAfterSecond.xp, rankAfterFirst.xp); // XP değişmedi
});

test('eşiğe yakın kullanıcı XP kazanınca seviye atlar ve fazla XP bir sonraki seviyeye taşınır', () => {
    const userId = 'u-levelup';
    // xpForLevel(0) = 100. 85 XP + en az 15 (garanti kazanç) >= 100 -> kesin seviye atlar.
    writeJSON('levels.json', { [GUILD]: { [userId]: { xp: 85, level: 0 } } });

    const newLevel = levelSystem.addXp(GUILD, userId);
    assert.equal(newLevel, 1);

    const rank = levelSystem.getRank(GUILD, userId);
    assert.equal(rank.level, 1);
    assert.ok(rank.xp >= 0 && rank.xp < 15); // taşan XP en fazla 85+25-100=10 olabilir
});

test('getLeaderboard seviye ve XP\'ye göre azalan sırada döner', () => {
    const guild = 'g-leaderboard';
    writeJSON('levels.json', {
        [guild]: {
            low: { xp: 10, level: 0 },
            high: { xp: 5, level: 3 },
            mid: { xp: 50, level: 1 }
        }
    });

    const board = levelSystem.getLeaderboard(guild, 10);
    assert.deepEqual(board.map(e => e.userId), ['high', 'mid', 'low']);
});
