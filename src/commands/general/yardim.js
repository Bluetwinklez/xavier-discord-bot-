const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// guildCreate.js bu fonksiyonu import edip yeni sunucuya katılınca otomatik oluşturulan AI
// kanalına da aynı embed'i gönderiyor — komut metnini tek yerde tutup iki kopya olmasın diye.
function buildHelpEmbed(client) {
    return new EmbedBuilder()
        .setColor(0x00FF99)
        .setTitle('🤖 Bot Komut Rehberi')
        .setDescription('Kullanabileceğiniz tüm slash (`/`) komutları:')
        .addFields(
            {
                name: '🧠 Yapay Zeka (AI)',
                value: '`/ai <soru>` - Yapay zekaya soru sorar\n`/ai-panel` - Tüm AI ayarlarını tek panelden yönetir\n`/ai-kanal-ayarla` - Etiketsiz sohbet edilebilecek AI kanalını belirler\n`/ai-rol-ayarla` - AI kullanım iznini belirli bir role sınırlar\n`/ai-modu` - Yapay zekanın kişiliğini değiştirir\n`/ai-ciz` - Yapay zeka ile resim çizer\n`/ai-araclar` - Özet, kod açıklama, mülakat, analiz, burç, çeviri, roast, iltifat, söz yazma, trivia, ortam modu\n`/ai-ozellik-ekle` - Özel komut/otomatik cevap veya kalıcı bilgi öğretir\n*(İpucu: botu `@etiketleyerek` herhangi bir kanalda doğrudan sohbet edebilirsiniz!)*'
            },
            {
                name: '🛡️ Moderasyon',
                value: '`/ban`, `/kick`, `/timeout`, `/sil` - Temel moderasyon işlemleri\n`/uyar`, `/uyarilar`, `/uyari-sil`, `/uyarilari-temizle` - Uyarı sistemi (3 uyarıda otomatik susturma)\n`/moderasyon-gecmisi` - Ban/kick/timeout/uyarı geçmişini tek ekranda gösterir\n`/otomod-ayarla` - Yasaklı kelime, davet linki engelleme, spam eşiği\n`/guvenlik-kilidi` - Anti-raid güvenlik kilidi (otomatik de tetiklenir)\n`/log-kur` - Moderasyon olaylarının kaydedileceği log kanalı'
            },
            {
                name: '🏗️ Sunucu Kurulumu & Tema',
                value: '`/sunucu-kur` - Sunucuyu Gaming temasına göre tek seferde kurar\n`/tema-sec` - Hazır temalardan seçip önizleyerek kurar\n`/tema-ai-olustur` - Yapay zeka ile özel temaya göre kanal/rol tasarlar\n`/kanallari-duzenle` - Mevcut kanalları silmeden emojili düzenler\n`/kurallar-gonder` - Kurallar panosu ve afiş gönderir\n`/duyuru` - Biçimli duyuru gönderir\n`/yedek-al`, `/yedek-listele`, `/yedek-geri-yukle` - Rol/kanal yapısını yedekle ve geri yükle'
            },
            {
                name: '👋 Karşılama & Kayıt',
                value: '`/kayit-sistemi-kur` - Butonlu kayıt sistemi kurar\n`/giriscikis-ayarla` - Giriş-çıkış bildirim kanalı\n`/otorol-ayarla` - Yeni üyelere otomatik verilecek rol'
            },
            {
                name: '🎫 Destek Sistemi',
                value: '`/ticket-kur` - Butonlu destek paneli kurar (yetkili rol seçilebilir)'
            },
            {
                name: '🎵 Müzik',
                value: '`/muzik` - Tek komutta oynat/durdur/duraklat/devam/gec/kuyruk/radyo/ayril\n`/durdur`, `/devam`, `/kuyruk`, `/kuyruktan-cikar`, `/karistir`, `/tekrar`, `/ses-seviyesi`, `/ayril` - Ayrı kısayol komutları'
            },
            {
                name: '🎙️ Ses Botu & Radyo',
                value: '`/radyo` - Canlı radyo veya 7/24 Lofi yayını\n`/seslendir` - Yazdığınız metni seslendirir (TTS)\n`/seste-kal`, `/sesten-ayril` - Ses kanalına kalıcı bağlan / ayrıl\n`/sesle-dinle`, `/sesle-dinle-durdur` - Sesle konuşarak komut verme'
            },
            {
                name: '🔊 Geçici Ses Odaları',
                value: '`/gecici-oda-kur` - "Oda Oluştur" sistemini kurar\n`/oda-isim`, `/oda-limit`, `/oda-kilit`, `/oda-at` - Sahibi olduğunuz odayı yönetin'
            },
            {
                name: '💰 Ekonomi & Mağaza',
                value: '`/bakiye`, `/gunluk`, `/calis`, `/transfer`, `/zengin-listesi` - Temel ekonomi\n`/market` - Bakiyenizle isim rengi satın alın\n`/blackjack`, `/slot`, `/carkifelek` - Şans oyunları'
            },
            {
                name: '🎮 Seviye, Çekiliş, Self-Rol',
                value: '`/seviye`, `/liderlik-tablosu`, `/seviye-ayarla` - XP/seviye sistemi\n`/cekilis-baslat`, `/cekilis-bitir` - Butonlu çekiliş\n`/self-rol-ekle`, `/self-rol-yayinla` - Kendi kendine alınabilir roller'
            },
            {
                name: '📊 Sosyal & Eğlence',
                value: '`/anket` - Reaksiyonlu anket\n`/itiraf-et`, `/itiraf-kanali-kur` - Anonim itiraf sistemi\n`/davet` - Davet istatistikleri ve sıralaması (gerçek davetler jeton ödülü verir)\n`/dogum-gunu-ayarla`, `/dogum-gunu-kanali-ayarla` - Doğum günü kutlaması\n`/afk` - AFK durumu\n`/hatirlat`, `/hatirlatma-yonet` - Hatırlatıcı kur / listele / iptal et\n`/rozetler` - Kazanılan başarımlar\n`/oyun-kur` - Kelime türetmece / sayı saymaca mini oyunları\n`/bulten-yayinla`, `/haber-kanali-kur`, `/haber-paylas` - Otomatik bülten ve teknoloji haberleri'
            },
            {
                name: '🌐 Yardımcı Araçlar',
                value: '`/kod-calistir` - Kodunuzu gerçek bir sandbox\'ta çalıştırır (Python, JS, C++, Java, Go, Rust, PHP, C#, TS)\n`/hata-coz` - Kod/terminal hatanızı analiz eder\n`/github` - Bir GitHub reposunu gösterir\n`/hava-durumu`, `/kur` - Hava durumu ve döviz kuru\n`/sozluk` - İngilizce kelime anlamı\n`/snippet` - Kod parçacığı kaydet/ara\n`/pomodoro` - Odaklanma/mola seansı\n`/saka`, `/tavsiye` - Rastgele eğlence'
            },
            {
                name: '📊 İstatistik & ⭐ Starboard',
                value: '`/istatistik-kur`, `/istatistik-kaldir` - Üye/bot/boost sayacı kanalları\n`/starboard-kur` - Çok tepki alan mesajları öne çıkarır'
            },
            {
                name: 'ℹ️ Genel',
                value: '`/ping` - Gecikme süresi\n`/sunucubilgi`, `/kullanicibilgi` - Sunucu/kullanıcı bilgisi\n`/yardim` - Bu menü'
            }
        )
        .setFooter({ text: 'Discord.js v14 ile hazırlanmıştır.', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
}

module.exports = {
    buildHelpEmbed,
    data: new SlashCommandBuilder()
        .setName('yardim')
        .setDescription('Tüm bot komutlarını ve özelliklerini listeler.'),
    async execute(interaction) {
        await interaction.reply({ embeds: [buildHelpEmbed(interaction.client)] });
    },
};
