// Discord'un resmi sunucu şablonu (discord.new/<kod> veya discord.com/template/<kod>) JSON'unu
// bizim iç tema şemamıza (bkz. themeCatalog.js validateThemeSchema/applyThemeToGuild) çevirir —
// bu sayede tema önizleme/kurulum/otomatik-yedek akışının TAMAMI hiç değiştirilmeden, hazır AI
// temaları gibi, içe aktarılan şablonlar için de aynen çalışır.
const { ChannelType, PermissionFlagsBits } = require('discord.js');

// Şablonlardaki duyuru/forum/stage gibi tipler bizim desteklediğimiz 2 tipe (metin/ses)
// düşürülür — bilgi kaybı olur ama kurulum en azından hiç başarısız olmaz.
function mapChannelType(rawType) {
    if (rawType === 2 || rawType === 13) return ChannelType.GuildVoice; // Voice, Stage Voice
    return ChannelType.GuildText; // Text, Announcement, Forum, vb.
}

function isReadonlyForEveryone(channel, everyoneTemplateRoleId) {
    if (!everyoneTemplateRoleId) return false;
    const overwrite = (channel.permission_overwrites || []).find(o => o.id === everyoneTemplateRoleId);
    if (!overwrite) return false;
    const denyBits = BigInt(overwrite.deny || 0);
    return (denyBits & PermissionFlagsBits.SendMessages) === PermissionFlagsBits.SendMessages;
}

function convertChannel(ch, everyoneTemplateRoleId) {
    return {
        name: ch.name,
        type: mapChannelType(ch.type),
        userLimit: ch.user_limit || 0,
        readonly: isReadonlyForEveryone(ch, everyoneTemplateRoleId)
    };
}

// template: discord.js'in client.fetchGuildTemplate(link) ile döndürdüğü GuildTemplate nesnesi.
function convertTemplateToTheme(template) {
    const src = template.serializedGuild;
    if (!src) throw new Error('Şablon verisi okunamadı (serialized_source_guild boş).');

    const everyoneRole = (src.roles || []).find(r => r.name === '@everyone');
    const roles = (src.roles || [])
        .filter(r => r.name !== '@everyone')
        .map(r => ({
            name: r.name,
            color: typeof r.color === 'number' ? r.color : 0,
            permissions: r.permissions !== undefined ? BigInt(r.permissions) : []
        }));

    const rawChannels = src.channels || [];
    const categoryChannels = rawChannels.filter(c => c.type === ChannelType.GuildCategory);
    const nonCategoryChannels = rawChannels.filter(c => c.type !== ChannelType.GuildCategory);

    const categories = categoryChannels
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map(cat => ({
            name: cat.name,
            channels: nonCategoryChannels
                .filter(ch => ch.parent_id === cat.id)
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                .map(ch => convertChannel(ch, everyoneRole?.id))
        }))
        .filter(cat => cat.channels.length > 0);

    // Kategorisiz kalan kanallar (parent_id'si hiçbir kategoriye denk gelmeyenler) tek bir
    // "Kategorisiz" başlığı altında toplanır — şemamız kategorisiz kanalı desteklemiyor.
    const uncategorized = nonCategoryChannels.filter(ch => !categoryChannels.some(cat => cat.id === ch.parent_id));
    if (uncategorized.length > 0) {
        categories.unshift({
            name: '📁 │ Kategorisiz',
            channels: uncategorized
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                .map(ch => convertChannel(ch, everyoneRole?.id))
        });
    }

    if (categories.length === 0) {
        throw new Error('Şablonda içe aktarılabilecek hiçbir kanal bulunamadı.');
    }

    return {
        name: `📥 ${template.name || src.name || 'İçe Aktarılan Şablon'}`,
        description: template.description || `discord.new/${template.code} şablonundan içe aktarıldı.`,
        color: 0x5865F2,
        roles,
        categories
    };
}

module.exports = { convertTemplateToTheme };
