# Değişiklik Günlüğü

Bu proje [Semantic Versioning](https://semver.org/lang/tr/) kullanır: `MAJOR.MINOR.PATCH`.
- **MAJOR**: geriye uyumsuz değişiklik (ör. bir komutun kaldırılması/yeniden adlandırılması)
- **MINOR**: geriye uyumlu yeni özellik
- **PATCH**: geriye uyumlu hata düzeltmesi

Format [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/)'a dayanır.

## [Yayınlanmamış]

Henüz `main`'e eklenmiş ama etiketlenmemiş bir değişiklik yok.

## [1.0.0] - 2026-09-16

İlk genel yayın — depo public GitHub'a taşındı ve proje standart bir açık kaynak yapısına kavuşturuldu.

### Eklendi
- 100 slash komutlu tam bot: moderasyon, otomod, log sistemi, kayıt/karşılama, seviye/ekonomi/çekiliş/self-rol, 10 hazır sunucu teması, ticket sistemi, müzik + canlı radyo + TTS + sesle-komut, sunucu yedekleme, doğal dille yönetilebilen yapay zeka katmanı.
- Müzik: şarkı sözü gösterme, ses efekti (bassboost/nightcore), oy ile şarkı geçme.
- Rozet kazanınca otomatik log-kanalı bildirimi; çarkıfelekte günlük seri bonusu.
- Ücretsiz, anahtarsız **Edge TTS** — Fish Audio ile Google Translate yedeği arasına eklendi.
- **Cerebras** AI sağlayıcısı fallback zincirine eklendi.
- `npm run setup` — interaktif kurulum sihirbazı, `.env`'i otomatik oluşturur/günceller.
- **Discord sunucu şablonu (discord.new/...) içe aktarma** — `/tema-sec sablon-linki:`.
- `node:test` ile 28 gerçek birim test (`npm test`), GitHub Actions CI (her push/PR'da syntax + test).
- MIT lisans, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue/PR şablonları, Dependabot.

### Değişti
- `.env.example` koddaki tüm gerçek değişkenlerle (daha önce çoğu eksikti) tam eşleşecek şekilde yeniden yazıldı.
- README tamamen yeniden yazıldı: tüm komutlar kategori kategori, kurulum, mimari, katkı rehberi.

### Düzeltildi
- `/sesle-dinle`'nin Fish Audio değil `GROQ_API_KEY`/`GEMINI_API_KEY` kullandığına dair yanlış dokümantasyon.
