const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.BOT_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'botdata-test-'));
const economy = require('../src/utils/economyManager');

const GUILD = 'g1';

test('yeni kullanıcının bakiyesi 0 ile başlar', () => {
    assert.equal(economy.getBalance(GUILD, 'yeni-kullanici'), 0);
});

test('addBalance bakiyeyi artırır ve negatife düşürmez', () => {
    const userId = 'u-addbalance';
    assert.equal(economy.addBalance(GUILD, userId, 100), 100);
    assert.equal(economy.addBalance(GUILD, userId, -500), 0); // 100 - 500 -> 0'da sınırlanır
});

test('claimDaily ilk seferde ödül verir, aynı gün içinde tekrar vermez', () => {
    const userId = 'u-daily';
    const first = economy.claimDaily(GUILD, userId);
    assert.equal(first.ok, true);
    assert.equal(first.amount, economy.DAILY_AMOUNT);

    const second = economy.claimDaily(GUILD, userId);
    assert.equal(second.ok, false);
    assert.ok(second.remainingMs > 0);
});

test('work cooldown içindeyken kazandırmaz, miktar aralık içinde olur', () => {
    const userId = 'u-work';
    const first = economy.work(GUILD, userId);
    assert.equal(first.ok, true);
    assert.ok(first.amount >= economy.WORK_MIN && first.amount <= economy.WORK_MAX);

    const second = economy.work(GUILD, userId);
    assert.equal(second.ok, false);
});

test('transfer yetersiz bakiyede reddeder, yeterliyse iki tarafı da günceller', () => {
    const from = 'u-transfer-from';
    const to = 'u-transfer-to';
    economy.addBalance(GUILD, from, 300);

    const fail = economy.transfer(GUILD, from, to, 1000);
    assert.equal(fail.ok, false);
    assert.equal(fail.reason, 'insufficient');

    const ok = economy.transfer(GUILD, from, to, 200);
    assert.equal(ok.ok, true);
    assert.equal(ok.fromBalance, 100);
    assert.equal(ok.toBalance, 200);
});

test('buyItem: yeterli bakiyede satın alır, yetersizde reddeder, geçersiz id\'de not_found döner', () => {
    const userId = 'u-shop';
    const item = economy.getShopItems()[0];

    const noMoney = economy.buyItem(GUILD, userId, item.id);
    assert.equal(noMoney.ok, false);
    assert.equal(noMoney.reason, 'insufficient');

    economy.addBalance(GUILD, userId, item.price);
    const bought = economy.buyItem(GUILD, userId, item.id);
    assert.equal(bought.ok, true);
    assert.equal(bought.balance, 0);

    const invalid = economy.buyItem(GUILD, userId, 'olmayan-esya');
    assert.equal(invalid.ok, false);
    assert.equal(invalid.reason, 'not_found');
});

test('getLeaderboard bakiyeye göre azalan sırada döner', () => {
    const guild = 'g-leaderboard';
    economy.addBalance(guild, 'low', 10);
    economy.addBalance(guild, 'high', 100);
    economy.addBalance(guild, 'mid', 50);

    const board = economy.getLeaderboard(guild, 10);
    assert.deepEqual(board.map(e => e.userId), ['high', 'mid', 'low']);
});
