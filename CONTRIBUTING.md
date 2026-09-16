# Katkıda Bulunma Rehberi

Bu projeye katkı yapmak istediğin için teşekkürler! Bot kolayca genişletilebilecek şekilde tasarlandı — merkezi bir "komut listesi" dosyası yok, her şey klasör taraması ile otomatik bulunuyor.

## Hızlı Başlangıç

```bash
git clone https://github.com/Bluetwinklez/xavier-discord-bot-.git
cd xavier-discord-bot-
npm install
npm run setup    # .env dosyanı interaktif olarak oluşturur
npm test         # değişiklik yapmadan önce testlerin geçtiğini doğrula
npm run deploy && npm start
```

Detaylı kurulum adımları için [README.md](README.md#-kurulum) dosyasına bak.

## Nasıl katkı yapılır

1. Bu depoyu fork'la.
2. Değişikliğin için yeni bir branch aç (`git checkout -b ozellik/kisa-aciklama`).
3. Değişikliğini yap. Yeni bir slash komutu, olay dinleyicisi veya AI eylemi eklemenin tam adımları için [README.md'deki "Katkıda Bulunma / Bota Yeni Özellik Ekleme"](README.md#-katkıda-bulunma--bota-yeni-özellik-ekleme) bölümüne bak.
4. Mümkünse saf mantık (manager dosyaları) için test ekle — `test/` altındaki mevcut dosyalar örnek alınabilir. `npm test` gerçek `data/` klasörüne asla dokunmaz.
5. `npm test` ve gözle `node --check <değiştirdiğin dosya>` ile değişikliğini doğrula.
6. Pull request aç. GitHub Actions otomatik olarak syntax kontrolü + testleri çalıştıracak.

## Kod stili

- Kullanıcıya dönen tüm metinler **Türkçe** olmalı (bot tamamen Türkçe bir topluluk botu).
- Yorumlar sadece "neden" böyle yapıldığını (gizli bir kısıt, bug'lı bir davranışın nedeni) açıklar — "ne yaptığını" değil; kod zaten okunaklı isimlerle bunu anlatmalı.
- Mevcut dosyalardaki stil ve hata yönetimi kalıplarını (try/catch + `.catch(() => {})`, `ephemeral: true` hata mesajları, `requirePermission()` ile yetki kontrolü) takip et.
- Yeni bir top-level slash komutu eklemeden önce **Discord'un 100 komut sınırını** unutma — ilgili bir komuta alt komut eklemek genelde daha doğru (bkz. `/muzik`, `/market`, `/ai-araclar`).
- Kalıcı veri gerekiyorsa `src/utils/fileStore.js`'i kullan, yeni bir veritabanı bağımlılığı ekleme.

## Bug bildirme / özellik isteği

[Issues](https://github.com/Bluetwinklez/xavier-discord-bot-/issues) sekmesinden şablonlardan birini kullanarak aç. Bug bildiriminde ne yapmaya çalıştığını, ne beklediğini ve gerçekte ne olduğunu (varsa hata logu ile) yazman çözümü çok hızlandırır.

## Davranış Kuralları

Bu projeye katkıda bulunarak [Davranış Kuralları](CODE_OF_CONDUCT.md)'nı kabul etmiş olursun.
