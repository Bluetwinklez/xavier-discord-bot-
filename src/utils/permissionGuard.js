// Moderasyon/yönetim komutları eskiden yetkilendirmeyi SADECE setDefaultMemberPermissions()'a
// bırakıyordu — bu sadece Discord'un komut menüsündeki VARSAYILAN görünürlüğü/izni; bir sunucu
// admini "Sunucu Ayarları > Entegrasyonlar" ekranından bunu HER ZAMAN override edip komutu daha
// düşük yetkili bir role veya kanala açabilir. execute() içinde gerçek zamanlı ikinci bir kontrol
// olmadan, o override yapıldığında yetkisiz biri botun kendi (yüksek) yetkisini kullanarak ban/kick/
// sunucu sıfırlama gibi işlemler yapabilir. Bu yardımcı, her komutun başında tek satırla o ikinci
// kontrolü ekliyor.
const PERMISSION_LABELS = new Map([
    ['BanMembers', 'Üyeleri Banla'],
    ['KickMembers', 'Üyeleri At'],
    ['ModerateMembers', 'Üyeleri Zamanaşımına Uğrat'],
    ['ManageMessages', 'Mesajları Yönet'],
    ['ManageGuild', 'Sunucuyu Yönet'],
    ['ManageChannels', 'Kanalları Yönet'],
    ['ManageRoles', 'Rolleri Yönet'],
    ['Administrator', 'Yönetici']
]);

function labelFor(permission) {
    for (const [name, label] of PERMISSION_LABELS) {
        if (require('discord.js').PermissionFlagsBits[name] === permission) return label;
    }
    return 'gerekli';
}

// true/false döner; false ise kendisi ephemeral hata mesajıyla zaten yanıtlamıştır — çağıran
// yer sadece `if (!requirePermission(...)) return;` yazsın yeterli.
function requirePermission(interaction, permission) {
    if (interaction.member.permissions.has(permission)) return true;
    interaction.reply({
        content: `❌ Bu komutu kullanmak için **${labelFor(permission)}** yetkisine sahip olmalısınız.`,
        ephemeral: true
    }).catch(() => {});
    return false;
}

module.exports = { requirePermission };
