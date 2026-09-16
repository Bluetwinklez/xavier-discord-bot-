# Bot Geliştirme Notları

Bu dosya, botun geliştirme sürecinde alınan önemli kararları ve çözülen kritik sorunları özetler — kodun kendisinden anlaşılmayan "neden"leri içerir.

## ⚠️ Zorunlu Yeniden Başlatma Kuralı

Her `npm start` öncesi, çalışan tüm `node index.js` süreçlerini öldür ve 0 kaldığını doğrula; başlattıktan sonra tam 1 tane çalıştığını doğrula. **Sebep:** Geçmişte birden fazla botun aynı anda çalışması, tek bir olayın (örn. sesli kanala giriş) birden çok kez tetiklenmesine (örn. bir sürü geçici oda oluşması) yol açtı. Kök sebep tam çözülemedi, bu yüzden bu kontrol kalıcı bir kural.

**Dikkat:** Bu makinede botla alakasız birçok `node.exe` süreci de çalışıyor olabilir (OpenClaw, MCP sunucuları vs.) — sadece gerçek `index.js` komut satırına sahip olanı hedefle.

## 🎙️ Sesli Komut Sistemi — Kritik Bug'lar

1. **selfDeaf hatası:** Bot ses kanalına `selfDeaf: true` (kendini sağır) ile bağlanırsa, Discord ona gelen sesi HİÇ iletmez. Bu, ASR'ın rastgele yabancı dilde saçma metinler üretmesine (aslında boş/gürültülü ses aldığı için) sebep oluyordu. Çözüm: dinleme gerektiren bağlantılar `selfDeaf: false` ile açılmalı; sadece ses çalan (TTS/radyo) bağlantılar bu parametreyi hiç vermemeli (mevcut bağlantıyı bozmadan paylaşsınlar diye).

2. **STT motoru:** Fish Audio ASR yerine **Groq Whisper Large v3 Turbo** (birincil) + **Gemini 2.5 Flash** (yedek) kullanılıyor — çok daha hızlı ve doğru.

3. **AI model zinciri kırılgan:** Groq zaman zaman eski model ID'lerini (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`) kaldırıyor. Bu olduğunda TÜM istekler (yazılı+sesli) 30-40 saniyeye varan gecikmeyle sonuçlanıyor çünkü kod sırayla tüm sağlayıcıları deniyor. **Belirti: bot geç cevap veriyor.** Çözüm: `https://api.groq.com/openai/v1/models` ile güncel model listesini kontrol et, `aiManager.js`'teki `callAIProviders` fonksiyonundaki model isimlerini güncelle. Şu an `qwen/qwen3.8-27b` kullanılıyor (hızlı, temiz çıktı — `gpt-oss` modelleri düşünce metnini cevaba karıştırıyor, kullanma).

4. Gemini'de de aynı sorun var: `GEMINI_MODEL` env değişkeni (`.env`'de `gemini-3.6-flash`) kullanılıyor, kod içindeki eski hardcoded varsayılan (`gemini-2.5-flash`) artık çalışmıyor.

## 🐟 Fish Audio (TTS)

`.env`'de `FISHAUDIO_API_KEY` ve `FISHAUDIO_VOICE_ID` ayarlı. Hesapta kredi bitmişse `api.fish.audio`'dan 402 hatası döner (yetki sorunu değil, bakiye sorunu — fish.audio/app/developers'tan yükle).

## 🖥️ VDS/Sunucu Kararı (henüz kesinleşmedi)

Botu barındırmak için değil, genel amaçlı "ekstra PC" olarak bir VDS aranıyor. Üç somut seçenek çıkarıldı (fiyatlar 2026-09-01 itibarıyla):
- **Contabo Cloud VPS 4** — €4.40-6.60/ay, 4vCPU/8GB RAM (en iyi fiyat/performans)
- **Natro XCloud Pro** — 29.99₺/ay (ilk 3 ay), Türkiye lokasyon
- **Hosting.com.tr VDS Ultra 80** — $9.99/ay (ilk 3 ay)

VDS ile VPS arasında artık teknik fark yok (ikisi de KVM tam sanallaştırma) — sadece pazarlama ismi farkı. Linux (Ubuntu/Debian) kurulacak, üzerine GPU gerektirmeyen bir masaüstü ricing (DWM/i3/bspwm tabanlı) düşünülüyor — Hyprland tabanlı `end4-pC` gibi projeler GPU/ekran gerektirdiği için uygun değil.

## 🎵 Mimari Notlar

- İki ayrı bot: **xavier** (ana bot: sohbet/AI/moderasyon/sesli komut) + **doom v2** (sadece müzik, `MUSIC_BOT_TOKEN`) — aynı anda iki farklı sesli bağlantı gerektiği için ayrıldılar.
- AI eylemleri `aiActionExecutor.js`'teki `executeAction()` üzerinden yürütülüyor, doğal dil kalıpları `aiManager.js`'teki regex listesinde.
