# 🤖 Xavier — Çok İşlevli Discord Botu

Discord.js v14 üzerine kurulu, **100 slash komutlu**, tamamen Türkçe bir topluluk botu. Moderasyon, otomod, log sistemi, kayıt/karşılama, seviye/ekonomi/çekiliş/self-rol, hazır sunucu temaları, ticket sistemi, tam müzik + canlı radyo + TTS + sesle-komut, sunucu yedekleme ve **doğal dille (Türkçe) komut verilebilen bir yapay zeka katmanı** içerir.

> Bu proje kişisel/topluluk kullanımı için geliştirildi. Kodu inceleyip kendi sunucun için kurabilir, dallandırabilir veya üstüne yeni özellik ekleyebilirsin — aşağıda [Katkıda Bulunma / Bota Yeni Özellik Ekleme](#-katkıda-bulunma--bota-yeni-özellik-ekleme) bölümünde mimari buna nasıl izin verdiği anlatılıyor.

---

## 📚 İçindekiler

- [Öne Çıkan Özellikler](#-öne-çıkan-özellikler)
- [Gereksinimler](#-gereksinimler)
- [Kurulum](#-kurulum)
  - [1. Ana Botu Oluşturma](#1-ana-botu-oluşturma)
  - [2. Botları Sunucuya Davet Etme](#2-botları-sunucuya-davet-etme)
  - [3. Yapılandırma (.env)](#3-yapılandırma-env)
  - [4. Başlatma](#4-başlatma)
- [Tam Komut Rehberi (100 komut)](#-tam-komut-rehberi-100-komut)
- [Yapay Zeka Katmanı](#-yapay-zeka-katmanı)
- [Mimari Notları](#️-mimari-notları)
- [Katkıda Bulunma / Bota Yeni Özellik Ekleme](#-katkıda-bulunma--bota-yeni-özellik-ekleme)
- [Sorun Giderme](#-sorun-giderme)

---

## ✨ Öne Çıkan Özellikler

| Kategori | Neler var? |
|---|---|
| 🧠 **Yapay Zeka** | Doğal dille yönetim ("log kanalı aç", "otomodu aç", "sesi 50 yap" gibi cümlelerle), 9 farklı AI kişiliği, öğrenilebilir özel komut/bilgi, yetki devredilebilir "AI Yönetici Rolü", 9 sağlayıcılı otomatik fallback zinciri (biri çökerse/limitlenirse otomatik sıradakine geçer) |
| 🛡️ **Moderasyon & Güvenlik** | ban/kick/timeout/uyarı sistemi + geçmiş, otomatik moderasyon (yasaklı kelime + leetspeak/boşluk atlatma koruması, davet linki engelleme, spam eşiği), Anti-Raid güvenlik kilidi, tam denetim log sistemi |
| 🎨 **Kurulum & Temalar** | 7 hazır tema (Gaming, Yazılımcı, Chill, Anime, Ders, Tasarım, Müzik) tek komutla kurulur, AI'ye özel tema tasarlatma, kanalları silmeden yeniden düzenleme |
| 📈 **Topluluk & Ekonomi** | Mesaj bazlı XP/seviye sistemi, sunucu içi ekonomi (günlük ödül, çalışma, market, transfer), blackjack/slot/çarkıfelek (günlük seri bonuslu), davet takibi + ödülü, doğum günü kutlama, rozet/başarım sistemi (kazanınca otomatik bildirim) |
| 🎵 **Müzik & Ses** | YouTube/Instagram/TikTok/Twitter gibi kaynaklardan çalma, kuyruk yönetimi, ses efekti (bassboost/nightcore), şarkı sözü gösterme, oy ile şarkı geçme, 5 canlı radyo istasyonu, metin-seslendirme (TTS), sesle-komut dinleme (STT), geçici ses odaları (Join to Create) |
| 🎫 **Destek & Katılım** | Butonlu ticket sistemi (kapanışta otomatik transkript), kayıt sistemi (captcha doğrulamalı), self-rol menüsü, çekiliş sistemi, anonim itiraf kanalı, anket, mini kanal oyunları |
| 💾 **Yedekleme** | Sunucu rol/kanal yapısını (izinleriyle birlikte) yedekler, geri yükleme sadece eksik olanı ekler — hiçbir şeyi silmez |
| 🌐 **Ücretsiz API Araçları** | Hava durumu, döviz çevirici, sözlük, kod çalıştırma (gerçek sandbox), GitHub repo bilgisi, hata çözümleyici, pomodoro — çoğu API anahtarı gerektirmez |

---

## 📋 Gereksinimler

- **Node.js** v18 veya üstü (test edilen sürüm: v24)
- **Discord Developer Portal** hesabı
- (Opsiyonel) **Fish Audio API anahtarı** — TTS ve sesle-komut (STT) için
- (Opsiyonel) **İkinci bir Discord bot token'ı** — müziği ana bottan ayrı çalıştırmak için
- (Opsiyonel) En az bir **AI sağlayıcı API anahtarı** (Gemini önerilir, ücretsiz kotası var) — yapay zeka katmanı için

---

## 🚀 Kurulum

### 1. Ana Botu Oluşturma

1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **Bot** sekmesi → **Reset Token** → token'ı kopyala.
3. **Privileged Gateway Intents** altında şunları aç: **Server Members Intent**, **Message Content Intent**. (Presence gerekmiyor.)
4. **General Information**'dan **Application ID**'yi kopyala.

#### (Opsiyonel) İkinci Bot — Müzik Botu

Müzik sistemini ana bottan bağımsız çalıştırmak istersen (böylece ana bot aynı anda radyo/TTS/sesle-komut kullanırken müzik de kendi bağlantısında çalar), aynı adımlarla **ikinci bir uygulama** daha oluştur, `bot`, `Connect`, `Speak`, `View Channels`, `Send Messages` izinleriyle **aynı sunucuya** davet et. Bu adım atlanırsa müzik otomatik olarak ana bot üzerinden çalışır, hiçbir şey bozulmaz.

### 2. Botları Sunucuya Davet Etme

**OAuth2 → URL Generator** → Scopes: `bot`, `applications.commands` → Bot Permissions: `Administrator` (önerilir) → oluşan linkle sunucuna ekle. **`applications.commands` scope'unu unutma** — eksikse slash komutları sunucuda hiç görünmez. İkinci (müzik) botu davet ederken sadece ses+mesaj izinleri yeterlidir.

### 3. Yapılandırma (.env)

Proje kökünde `.env.example` dosyasını `.env` olarak kopyala ve doldur:

```env
DISCORD_TOKEN=ANA_BOT_TOKENI
CLIENT_ID=ANA_BOT_CLIENT_ID

# (Opsiyonel) Komutları tek bir sunucuda ANINDA aktif etmek için (geliştirme/test):
GUILD_ID=SUNUCU_IDSI

# (Opsiyonel) Müziği ayrı bir bota taşımak için:
MUSIC_BOT_TOKEN=IKINCI_BOT_TOKENI
MUSIC_BOT_CLIENT_ID=IKINCI_BOT_CLIENT_ID

# 🧠 AI sağlayıcıları (en az biri gerekli — Gemini önerilir, ücretsiz kotası var)
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
DEEPSEEK_API_KEY=
OPENCLAW_BASE_URL=http://127.0.0.1:18789/v1
OPENCLAW_API_KEY=

# 🐟 Fish Audio (opsiyonel) — TTS ve sesle-komut (STT) için. Boşsa TTS resmi olmayan
# Google Translate yöntemine düşer, sesle-komut (/sesle-dinle) çalışmaz.
FISHAUDIO_API_KEY=
```

> `GUILD_ID` ayarlanmazsa komutlar **global** kaydedilir ve Discord'da görünmesi saatler sürebilir. Test/geliştirme sırasında `GUILD_ID` ayarlaman şiddetle önerilir.

> ⚠️ **`.env` dosyanı asla paylaşma veya bir Git deposuna ekleme.** Bu depo `.gitignore` ile `.env`'i, `data/` klasörünü (kullanıcı verileri) ve `logs/`'u zaten dışarıda tutuyor — public bir repoya yüklerken hiçbir token/anahtar/kullanıcı verisi gitmez.

### 4. Başlatma

```bash
npm install
npm run deploy   # Slash komutlarını Discord'a yükler
npm start        # Botu (veya botları) başlatır
```

Kod değiştirdikten sonra (özellikle yeni komut eklediğinde) `npm run deploy`'u tekrar çalıştırman gerekir.

---

## 📜 Tam Komut Rehberi (100 komut)

### 👤 Genel (`general/`)

| Komut | Açıklama |
|---|---|
| `/afk` | AFK (uzakta) durumuna geçersiniz. |
| `/ai` | OpenClaw yapay zekası ile sohbet edin veya bir soru sorun. |
| `/ai-araclar` | Alt komutlar: `ozet`, `kod`, `mulakat`, `analiz`, `burc`, `cevir`, `roast`, `iltifat`, `soz-yaz`, `trivia`, `ortam-modu` — genişletilmiş AI araç kutusu. |
| `/ai-ciz` | Yapay zeka ile hayal ettiğiniz resmi sıfırdan çizer. |
| `/ai-kanal-ayarla` | Kullanıcıların etiket atmadan AI ile doğrudan konuşabileceği kanalı belirler. |
| `/ai-modu` | Yapay zekanın kişiliğini ve çalışma modunu değiştirir. |
| `/ai-ozellik-ekle` | Alt komutlar: `otomatik-cevap`, `bilgi-ogret`, `liste`, `sil` — AI'ye yeni otomatik cevap veya kalıcı bilgi öğretir. |
| `/ai-panel` | AI mod, kanal ve rol ayarlarını tek panelden yönetir. |
| `/ai-rol-ayarla` | AI'yi kullanabilmek için gereken özel rolü ayarlar/sıfırlar. |
| `/anket` | Bir anket oluşturur. |
| `/bakiye` | Sunucu içi para bakiyenizi gösterir. |
| `/blackjack` | Krupiyere karşı 21 (Blackjack) oynayın. |
| `/bulten-yayinla` | Bülten kanalını oluşturur, AI ile haftalık sunucu gazetesi yayınlar. |
| `/calis` | Çalışarak para kazanın (1 saatte bir). |
| `/carkifelek` | Günde 1 kez şans çarkı — coin + **günlük seri bonusu** (48 saat içinde tekrar çevirirsen artar). |
| `/davet` | Alt komutlar: `istatistik`, `siralama` — davet istatistikleri ve liderlik tablosu. |
| `/dogum-gunu-ayarla` | Kendi doğum gününüzü (ay/gün) kaydeder. |
| `/gunluk` | Günlük ödülünüzü toplayın (24 saatte bir). |
| `/haber-kanali-kur` | Otomatik teknoloji/AI haberleri kanalını kurar. |
| `/haber-paylas` | En son AI/teknoloji haberlerini çeker, özetler, paylaşır. |
| `/hatirlat` | Belirli bir süre sonra size hatırlatma gönderir. |
| `/hatirlatma-yonet` | Alt komutlar: `listele`, `iptal` — kurduğunuz hatırlatıcıları yönetir. |
| `/itiraf-et` | Kimliğiniz gizli kalacak şekilde itiraf kanalına anonim itiraf gönderir. |
| `/itiraf-kanali-kur` | Anonim itiraf kanalını oluşturur/ayarlar. |
| `/kullanicibilgi` | Bir kullanıcının/kendinizin profil bilgilerini gösterir. |
| `/liderlik-tablosu` | Sunucudaki en yüksek seviyeli üyeleri listeler. |
| `/market` | Alt komutlar: `listele`, `satin-al` — bakiyenizle isim rengi rolü satın alın. |
| `/oyun-kur` | Alt komutlar: `kelime`, `sayi` — kanal içi mini oyun (Kelime Türetmece / Sayı Saymaca) kurar. |
| `/ping` | Botun gecikme süresini gösterir. |
| `/rozetler` | Kazanılan sunucu rozetlerini/başarımlarını gösterir. |
| `/self-rol-ekle` | Kendi kendine alınabilir role listeye rol ekler. |
| `/self-rol-yayinla` | Rol seçim menüsünü kanala gönderir. |
| `/seviye` | Kendi veya başka bir kullanıcının seviye/XP bilgisini gösterir. |
| `/slot` | Slot makinesinde şansınızı deneyin. |
| `/sunucubilgi` | Mevcut sunucu hakkında genel bilgi gösterir. |
| `/transfer` | Başka bir kullanıcıya para gönderin. |
| `/yardim` | Tüm bot komutlarını ve özelliklerini listeler. |
| `/zengin-listesi` | Sunucudaki en zengin üyeleri listeler. |

### 🛡️ Moderasyon (`moderation/`)

| Komut | Açıklama |
|---|---|
| `/ban` | Belirtilen kullanıcıyı yasaklar. |
| `/cekilis-baslat` | Butonla katılımlı, süreli çekiliş başlatır. |
| `/cekilis-bitir` | Devam eden çekilişi erken bitirir, kazananı seçer. |
| `/dogum-gunu-kanali-ayarla` | Doğum günü kutlama mesajlarının kanalını ayarlar. |
| `/duyuru` | Belirtilen kanala başlıklı, biçimli duyuru gönderir. |
| `/guvenlik-kilidi` | Sunucuyu acil durumda kilitler (Anti-Raid) veya açar. |
| `/istatistik-kaldir` | İstatistik sayacı kanallarını/kategorisini kaldırır. |
| `/istatistik-kur` | Kendini güncelleyen üye/bot/boost sayacı ses kanalları oluşturur. |
| `/kanallari-duzenle` | Kanalları silmeden estetik emoji/tema ile yeniden adlandırır. |
| `/kick` | Belirtilen kullanıcıyı sunucudan atar. |
| `/kurallar-gonder` | Kurallar panosunu gönderir. |
| `/log-kur` | Denetim/moderasyon log kanalını kurar ve ayarlar. |
| `/moderasyon-gecmisi` | Bir kullanıcının ban/kick/timeout/uyarı geçmişini gösterir. |
| `/otomod-ayarla` | Alt komutlar: `durum`, `kelime-ekle`, `kelime-sil`, `kelime-listele`, `davet-linki`, `spam-esigi`. |
| `/seviye-ayarla` | Seviye/XP sistemini, bildirim kanalını, seviye rol ödüllerini ayarlar. |
| `/sil` | Kanalda toplu mesaj siler. |
| `/starboard-kur` | Çok tepki alan mesajları öne çıkaran starboard sistemini kurar. |
| `/sunucu-kur` | Sunucuyu Gaming temasına göre otomatik yapılandırır. |
| `/tema-ai-olustur` | AI ile belirttiğiniz konuya göre sunucu kanal/rol tasarlar. |
| `/tema-sec` | Hazır temaları listeler, önizler, onayla kurar. |
| `/timeout` | Kullanıcıya geçici susturma uygular. |
| `/uyar` | Kullanıcıya resmi uyarı verir, geçmişine kaydeder. |
| `/uyari-sil` | Bir kullanıcının belirli bir uyarısını siler. |
| `/uyarilar` | Bir kullanıcının uyarı geçmişini gösterir. |
| `/uyarilari-temizle` | Bir kullanıcının TÜM uyarılarını temizler. |
| `/yedek-al` | Sunucunun mevcut rol/kanal yapısının yedeğini alır. |
| `/yedek-geri-yukle` | Yedekte olup sunucuda artık olmayan rol/kanalları yeniden oluşturur. |
| `/yedek-listele` | Bu sunucu için alınmış yedekleri listeler. |

### 🎵 Müzik (`music/`) — ikinci bot ayarlıysa onun üzerinden çalışır

| Komut | Açıklama |
|---|---|
| `/muzik` | Alt komutlar: `oynat`, `durdur`, `duraklat`, `devam`, `gec`, `kuyruk`, `radyo`, `ayril`, `sozler`, `efekt`, `oy-gec` — kapsamlı müzik ve canlı radyo sistemi. |
| `/ayril` | Botu ses kanalından ayırır, kuyruğu temizler. |
| `/devam` | Duraklatılmış müziği sürdürür. |
| `/durdur` | Çalan müziği duraklatır. |
| `/karistir` | Müzik kuyruğunu karıştırır. |
| `/kuyruk` | Müzik kuyruğunu listeler. |
| `/kuyruktan-cikar` | Kuyruktan belirli bir sıradaki şarkıyı çıkarır. |
| `/ses-seviyesi` | Çalan müziğin ses seviyesini ayarlar (0-200). |
| `/tekrar` | Çalan şarkının tekrar (loop) modunu açar/kapatır. |

`/muzik sozler` çalan şarkının sözlerini gösterir (lyrics.ovh), `/muzik efekt` bassboost/nightcore ses efekti uygular (ffmpeg), `/muzik oy-gec` ses kanalındaki çoğunluk oyuyla şarkı atlar.

### 🎙️ Ses Botu, Radyo, Geçici Odalar (`voice/`) — ana bot üzerinden çalışır

| Komut | Açıklama |
|---|---|
| `/gecici-oda-kur` | Kullanıcıların kendi özel ses odalarını oluşturabileceği sistemi kurar (Join to Create). |
| `/oda-at` | Sahip olduğunuz geçici odadan bir kullanıcıyı çıkarır. |
| `/oda-isim` | Geçici ses odanızın adını değiştirir. |
| `/oda-kilit` | Geçici odanızı kilitler/açar. |
| `/oda-limit` | Geçici ses odanızın kişi sınırını ayarlar. |
| `/radyo` | Canlı radyo (PowerTürk, Fenomen, SlowTürk, Best FM) veya 7/24 Lofi yayını başlatır. |
| `/sesle-dinle` | **(Fish Audio gerekir)** Konuşmanızı dinleyip AI'ye işlettirir, yanıtı seste okur. |
| `/sesle-dinle-durdur` | Sesle komut dinlemeyi durdurur. |
| `/seslendir` | Yazdığınız metni ses kanalında seslendirir (TTS). |
| `/seste-kal` | Botu seçilen kanala 7/24 bağlar. |
| `/sesten-ayril` | Botu sesten çıkarır, 7/24 modunu kapatır. |

### 🎫 Destek (`ticket/`)

| Komut | Açıklama |
|---|---|
| `/ticket-kur` | Butonlu destek paneli kurar; kapanışta otomatik transkript (.txt) oluşturur. |

### 🛠️ Yardımcı Araçlar (`utility/`) — çoğu API anahtarı gerektirmez

| Komut | Açıklama |
|---|---|
| `/github` | Bir GitHub reposunun yıldız/dil/detaylarını gösterir. |
| `/hata-coz` | Karşılaştığınız kodlama/terminal hatasını analiz edip çözüm sunar. |
| `/hava-durumu` | Belirtilen şehrin güncel hava durumu (wttr.in). |
| `/kod-calistir` | Yazdığınız kodu gerçek bir sandbox'ta (Judge0 CE) çalıştırıp çıktısını gösterir. |
| `/kur` | Döviz kuru çevirir (frankfurter.app). |
| `/pomodoro` | Odaklanma/mola seansı başlatır. |
| `/saka` | Rastgele (İngilizce) şaka gönderir (JokeAPI). |
| `/snippet` | Alt komutlar: `kaydet`, `bul`, `listele`, `sil` — kod parçacığı kütüphanesi. |
| `/sozluk` | İngilizce kelime anlamı/telaffuzu (dictionaryapi.dev). |
| `/tavsiye` | Rastgele (İngilizce) hayat tavsiyesi (Advice Slip API). |

### 👋 Karşılama (`welcome/`)

| Komut | Açıklama |
|---|---|
| `/giriscikis-ayarla` | Üye katılma/ayrılma mesajlarının kanalını ayarlar. |
| `/kayit-sistemi-kur` | Hoş geldin kanalı + captcha doğrulamalı kayıt sistemi kurar. |
| `/otorol-ayarla` | Yeni katılanlara otomatik verilecek rolü ayarlar. |

---

## 🧠 Yapay Zeka Katmanı

### Doğal Dille Yönetim

AI kanalında yazarak veya botu etiketleyerek her şeyi doğal dille (Türkçe) yaptırabilirsin — *"log kanalı aç"*, *"otomodu aç"*, *"kayıt sistemi kur"*, *"sesi 50 yap"*, *"yedek al"*, *"neler yapabilirsin"* gibi. Yukarıdaki tüm slash komutların büyük kısmına karşılık gelen **70'ten fazla eylem** tanımlıdır (`/ai-panel` ile AI kanalı/modu/rolleri tek yerden yönetilir).

### AI Yönetici Rolü (Yetki Devri)

`/ai-panel` üzerinden bir **AI Yönetici Rolü** atanabilir (veya otomatik oluşturulabilir). Bu role sahip kişiler, kendi Discord yetkisi olmasa bile AI'ye ban/kick/kanal-rol yönetimi gibi **yönetim eylemleri** yaptırabilir. Bu role sahip olmayanlarla AI sadece sohbet eder ve normal bir üyenin yapabileceği şeyleri (müzik, zar, vb.) yaptırabilir — yönetim komutu vermeye çalışırsa reddedilir. Yıkıcı eylemler (tüm kanalları/rolleri silme vb.) ayrıca **çift onay** ister: aynı isteği 90 saniye içinde bir kez daha aynen yazman gerekir.

### Sağlayıcı Zinciri

`aiManager.js`, tek bir sağlayıcıya bağımlı kalmamak için sırayla dener: Gemini → Groq → Mistral → ZhipuAI → Groq (2.) → DeepSeek → SambaNova → OpenRouter → OpenClaw (yerel). Biri hata verir/limitlenirse otomatik sıradakine düşer, kullanıcı hiçbir şey fark etmez.

### Kişilik Modları

`/ai-modu` ile 9 farklı kişilik (Gemini, Claude, GPT, Grok, DeepSeek, Perplexity, Cursor, Qwen, Doctor Doom) arasında geçiş yapılabilir.

### Öğrenme

`/ai-ozellik-ekle` ile AI'ye sunucuya özel otomatik cevaplar veya kalıcı bilgiler öğretilebilir (sunucu başına en fazla 75 kayıt, en eskisi otomatik düşer).

---

## 🏗️ Mimari Notları

- **İki bot, tek kod tabanı:** `MUSIC_BOT_TOKEN` ayarlıysa `index.js` ikinci bir Discord bağlantısı açar; müzik sistemi o bağlantıyı kullanır. Böylece ana bot aynı anda farklı bir ses özelliği (radyo/TTS/sesle-komut) kullanabilir.
- **Komut/olay otomatik yükleme:** `src/commands/<kategori>/*.js` altındaki her dosya (doğru şekle sahipse) otomatik yüklenir — bkz. [Katkıda Bulunma](#-katkıda-bulunma--bota-yeni-özellik-ekleme). Aynı şekilde `src/events/*.js` altındaki her olay dosyası otomatik bağlanır.
- **Log sistemi** ayrı olay dosyalarıyla (mesaj/kanal/rol/ban/üye) çalışır, `sendServerLog()` üzerinden tek bir kanala akar.
- **Dosya tabanlı veri:** `data/` klasöründe JSON dosyaları (atomik yazım ile: geçici dosya + rename) — harici veritabanı gerekmez, sunucu başına anahtarlanır.
- **Uygulama logu:** `logs/YYYY-MM-DD.log` — hata ayıklama için.
- **Discord'un 100 slash komut sınırı:** Discord her uygulamayı (guild + global ayrı ayrı) en fazla 100 top-level komutla sınırlar. Bu depo tam 100'de — ilgili grup için alt komut (`sub`) eklemek, yeni top-level komut eklemekten her zaman tercih edilmeli.

---

## 🤝 Katkıda Bulunma / Bota Yeni Özellik Ekleme

Proje, yeni özellik eklemeyi kolaylaştıracak şekilde tasarlandı — merkezi bir "komut listesi" dosyası **yok**, her şey klasör taraması ile otomatik bulunuyor.

### Yeni bir slash komutu eklemek

1. `src/commands/<kategori>/` altına (mevcut kategorilerden biri: `general`, `moderation`, `music`, `ticket`, `utility`, `voice`, `welcome` — ya da yeni bir klasör) bir `.js` dosyası oluştur.
2. Şu şekli export et:
   ```js
   const { SlashCommandBuilder } = require('discord.js');
   module.exports = {
       data: new SlashCommandBuilder()
           .setName('komut-adi')
           .setDescription('Ne yaptığı'),
       async execute(interaction) {
           await interaction.reply('Merhaba!');
       },
   };
   ```
3. `npm run deploy` çalıştır — komut Discord'a yüklenir.
4. **100 komut sınırına dikkat et:** yeni bir top-level komut yerine, ilgisi olan mevcut bir komuta (`/muzik`, `/market`, `/ai-araclar` gibi) `.addSubcommand()` ile alt komut eklemek genelde daha doğru.

### Yeni bir olay dinleyicisi eklemek

`src/events/` altına, [discord.js Events enum](https://discord.js.org/docs/packages/discord.js/main/Events:Enum)'undan bir isim kullanarak:
```js
const { Events } = require('discord.js');
module.exports = {
    name: Events.MessageCreate,
    once: false, // sadece ilk tetiklemede çalışsın istersen true
    async execute(message) { /* ... */ },
};
```

### AI'nin yeni özelliği "doğal dille" de yapabilmesi için

1. `src/utils/aiActionExecutor.js` içine yeni bir `case 'eylem_adi':` bloğu ekle (mevcut case'lere bak, `guild`/`member`/`channel`/`params` context'i hazır geliyor).
2. `src/utils/aiManager.js`'deki sistem promptu listesine (`~satır 550-600` civarı, kategoriye göre gruplu) eylemi ve parametrelerini tek satır ekle — AI ancak listede gördüğü eylemi üretebilir.

### Veri saklama

Yeni bir özelliğin kalıcı veriye ihtiyacı varsa `src/utils/fileStore.js`'deki `readJSON(dosyaAdi, varsayilan)` / `writeJSON(dosyaAdi, veri)` yardımcılarını kullan — `data/<dosyaAdi>.json` içine atomik olarak yazar, ekstra bir veritabanı kurulumu gerekmez. Mevcut manager dosyaları (`economyManager.js`, `levelSystem.js`, `badgeManager.js` vb.) örnek alınabilir.

### Kod stili

- Kullanıcıya dönen tüm metinler **Türkçe**.
- Yorumlar sadece "neden" böyle yapıldığını (gizli bir kısıt, bug'lı bir davranışın nedeni) açıklar — "ne yaptığını" değil; kod zaten okunaklı isimlerle bunu anlatıyor.
- Mevcut dosyalardaki stil ve hata yönetimi kalıplarını (try/catch + `.catch(() => {})`, `ephemeral: true` hata mesajları) takip et.

---

## 🔧 Sorun Giderme

| Belirti | Olası neden |
|---|---|
| Slash komutları sunucuda görünmüyor | `npm run deploy` çalıştırılmamış, ya da bot `applications.commands` scope'u olmadan davet edilmiş — botu yeniden davet et. |
| Global komutlar geç görünüyor | Global kayıt Discord tarafında saatler sürebilir; test için `.env`'e `GUILD_ID` ekleyip tekrar deploy et (anında yüklenir). |
| Müzik çalmıyor | `yt-dlp` sürümü güncel değilse bazı linkler başarısız olabilir; `bin/yt-dlp.exe`'yi güncelle. |
| `/sesle-dinle` çalışmıyor | `FISHAUDIO_API_KEY` boşsa bu özellik devre dışı kalır — Fish Audio'dan anahtar al. |
| AI hiç yanıt vermiyor | `.env`'de hiçbir AI sağlayıcı anahtarı girilmemiş olabilir (en az biri zorunlu) — `GEMINI_API_KEY` ile başlaman önerilir. |
