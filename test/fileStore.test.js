const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// BOT_DATA_DIR, fileStore.js modül seviyesinde okunduğu için require'dan ÖNCE ayarlanmalı —
// böylece gerçek data/ klasörüne (canlı bot verisi) hiç dokunulmaz.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botdata-test-'));
process.env.BOT_DATA_DIR = tmpDir;
const { readJSON, writeJSON } = require('../src/utils/fileStore');

test('readJSON var olmayan dosya için varsayılanı döner ve dosyayı oluşturur', () => {
    const result = readJSON('yok.json', { a: 1 });
    assert.deepEqual(result, { a: 1 });
    assert.ok(fs.existsSync(path.join(tmpDir, 'yok.json')));
});

test('writeJSON + readJSON round-trip çalışır', () => {
    writeJSON('roundtrip.json', { hello: 'world', n: 42 });
    const result = readJSON('roundtrip.json', {});
    assert.deepEqual(result, { hello: 'world', n: 42 });
});

test('writeJSON atomik yazım yapar (yarım kalan .tmp dosyası kalmaz)', () => {
    writeJSON('atomik.json', { x: 1 });
    const files = fs.readdirSync(tmpDir);
    assert.ok(!files.some(f => f.endsWith('.tmp')), 'geçici dosya temizlenmemiş');
});

test('bozuk JSON içeriğinde okuma çökmez, varsayılana düşer', () => {
    fs.writeFileSync(path.join(tmpDir, 'bozuk.json'), '{ bu gecerli json degil', 'utf-8');
    const result = readJSON('bozuk.json', { fallback: true });
    assert.deepEqual(result, { fallback: true });
});
