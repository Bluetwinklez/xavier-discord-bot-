const { test } = require('node:test');
const assert = require('node:assert/strict');
const { convertTemplateToTheme } = require('../src/utils/discordTemplateImporter');
const { validateThemeSchema } = require('../src/utils/themeCatalog');

// Discord'un gerçek template API yanıtına yakın, küçültülmüş bir örnek (serialized_source_guild).
function fakeTemplate(overrides = {}) {
    return {
        code: 'abc123',
        name: 'Test Sunucusu',
        description: 'Test açıklaması',
        serializedGuild: {
            name: 'Test Sunucusu',
            roles: [
                { id: '0', name: '@everyone', color: 0, permissions: '104324673' },
                { id: '1', name: 'Moderatör', color: 15158332, permissions: '8589934591' },
                { id: '2', name: 'Üye', color: 0, permissions: '0' }
            ],
            channels: [
                { id: '10', type: 4, name: '📢 BİLGİ', position: 0, parent_id: null, permission_overwrites: [] },
                { id: '11', type: 0, name: 'duyurular', position: 0, parent_id: '10', permission_overwrites: [{ id: '0', deny: '2048', allow: '0' }] },
                { id: '12', type: 4, name: '🔊 SES', position: 1, parent_id: null, permission_overwrites: [] },
                { id: '13', type: 2, name: 'genel-ses', position: 0, parent_id: '12', user_limit: 5, permission_overwrites: [] },
                { id: '14', type: 5, name: 'resmi-duyuru', position: 1, parent_id: '10', permission_overwrites: [] },
                { id: '15', type: 0, name: 'kategorisiz-kanal', position: 2, parent_id: null, permission_overwrites: [] }
            ]
        },
        ...overrides
    };
}

test('convertTemplateToTheme: @everyone rolünü atlar, diğer rolleri taşır', () => {
    const theme = convertTemplateToTheme(fakeTemplate());
    const roleNames = theme.roles.map(r => r.name);
    assert.ok(!roleNames.includes('@everyone'));
    assert.deepEqual(roleNames, ['Moderatör', 'Üye']);
    assert.equal(theme.roles[0].color, 15158332);
});

test('convertTemplateToTheme: kategorileri ve içindeki kanalları doğru gruplar', () => {
    const theme = convertTemplateToTheme(fakeTemplate());
    const bilgiKat = theme.categories.find(c => c.name === '📢 BİLGİ');
    assert.ok(bilgiKat);
    assert.equal(bilgiKat.channels.length, 2); // duyurular + resmi-duyuru (announcement -> text'e düşer)
});

test('convertTemplateToTheme: duyuru (type 5) ve stage gibi tipler metin/ses\'e düşürülür', () => {
    const theme = convertTemplateToTheme(fakeTemplate());
    const bilgiKat = theme.categories.find(c => c.name === '📢 BİLGİ');
    const announcementCh = bilgiKat.channels.find(c => c.name === 'resmi-duyuru');
    assert.equal(announcementCh.type, 0); // GuildText
});

test('convertTemplateToTheme: @everyone için SendMessages engellenen kanal readonly işaretlenir', () => {
    const theme = convertTemplateToTheme(fakeTemplate());
    const bilgiKat = theme.categories.find(c => c.name === '📢 BİLGİ');
    const duyurular = bilgiKat.channels.find(c => c.name === 'duyurular');
    assert.equal(duyurular.readonly, true);
});

test('convertTemplateToTheme: kategorisiz kanallar "Kategorisiz" başlığı altında toplanır', () => {
    const theme = convertTemplateToTheme(fakeTemplate());
    const uncategorized = theme.categories.find(c => c.name.includes('Kategorisiz'));
    assert.ok(uncategorized);
    assert.ok(uncategorized.channels.some(c => c.name === 'kategorisiz-kanal'));
});

test('convertTemplateToTheme çıktısı validateThemeSchema\'yı geçer', () => {
    const theme = convertTemplateToTheme(fakeTemplate());
    const check = validateThemeSchema(theme);
    assert.equal(check.valid, true, check.error);
});

test('kanalı olmayan bir şablon anlamlı bir hata fırlatır', () => {
    const empty = fakeTemplate({ serializedGuild: { name: 'Boş', roles: [], channels: [] } });
    assert.throws(() => convertTemplateToTheme(empty), /kanal bulunamadı/);
});
