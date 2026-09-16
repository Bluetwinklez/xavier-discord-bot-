const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.BOT_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'botdata-test-'));
const { writeJSON } = require('../src/utils/fileStore');
const { getAllBadges } = require('../src/utils/badgeManager');

const GUILD = 'g1';

function badgeKeys(guildId, userId, daysInServer) {
    return getAllBadges(guildId, userId, daysInServer)
        .filter(b => b.unlocked)
        .map(b => b.key);
}

test('hiçbir eşiği geçmeyen kullanıcı sadece "hosgeldin" rozetine sahiptir', () => {
    const keys = badgeKeys(GUILD, 'u-sifir', 0);
    assert.deepEqual(keys, ['hosgeldin']);
});

test('seviye 5+ "geveze", seviye 10+ ayrıca "kidemli" rozetini açar', () => {
    writeJSON('levels.json', { [GUILD]: { 'u-lvl5': { xp: 0, level: 5 }, 'u-lvl10': { xp: 0, level: 10 } } });

    assert.ok(badgeKeys(GUILD, 'u-lvl5', 0).includes('geveze'));
    assert.ok(!badgeKeys(GUILD, 'u-lvl5', 0).includes('kidemli'));

    const lvl10Keys = badgeKeys(GUILD, 'u-lvl10', 0);
    assert.ok(lvl10Keys.includes('geveze') && lvl10Keys.includes('kidemli'));
});

test('1000+ bakiye "milyoner" rozetini açar, altında açmaz', () => {
    writeJSON('economy.json', {
        [GUILD]: { 'u-zengin': { balance: 1000, lastDaily: 0, lastWork: 0 }, 'u-fakir': { balance: 999, lastDaily: 0, lastWork: 0 } }
    });

    assert.ok(badgeKeys(GUILD, 'u-zengin', 0).includes('milyoner'));
    assert.ok(!badgeKeys(GUILD, 'u-fakir', 0).includes('milyoner'));
});

test('14+ gün sunucuda kalma "emektar" rozetini açar', () => {
    assert.ok(badgeKeys(GUILD, 'u-eski', 14).includes('emektar'));
    assert.ok(!badgeKeys(GUILD, 'u-yeni', 13).includes('emektar'));
});

test('3+ gerçek davet "elci" rozetini açar', () => {
    writeJSON('invites.json', {
        [GUILD]: { 'u-davetci': { regular: 3, fake: 0, left: 0, members: {} }, 'u-az-davetci': { regular: 2, fake: 5, left: 0, members: {} } }
    });

    assert.ok(badgeKeys(GUILD, 'u-davetci', 0).includes('elci'));
    // fake davetler total'a katılmaz, regular-left = 2 < 3
    assert.ok(!badgeKeys(GUILD, 'u-az-davetci', 0).includes('elci'));
});
