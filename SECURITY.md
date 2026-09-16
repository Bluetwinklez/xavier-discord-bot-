# Güvenlik Politikası

## Bir güvenlik açığı bulursan

Lütfen **public bir Issue açma**. Discord bot token'ları, AI sağlayıcı anahtarları gibi hassas verilerle çalışan bir proje olduğu için, bir açığın istismar edilebilir hale gelmeden önce özel olarak bildirilmesi önemli.

Bunun yerine:

1. GitHub'ın [private vulnerability reporting](https://github.com/Bluetwinklez/xavier-discord-bot-/security/advisories/new) özelliğini kullanarak bildir, **veya**
2. Repo sahibine GitHub üzerinden özel mesaj gönder.

Bildiriminde şunları belirt: açığın ne olduğu, nasıl tetiklendiği (mümkünse adım adım), ve etkisinin ne olabileceği (ör. token sızıntısı, yetkisiz komut çalıştırma, veri kaybı).

## Kapsam

Bu depo kişisel/topluluk kullanımı için geliştirilen bir Discord botudur, resmi bir ticari üründür değildir — buna göre "en iyi çaba" (best-effort) temelinde yanıt verilir, garanti edilen bir SLA yoktur.

Özellikle önem verilen konular:
- `.env` içeriğinin (token/API anahtarları) herhangi bir şekilde sızması
- AI aksiyon yürütücüsündeki (`src/utils/aiActionExecutor.js`) yetki kontrolü atlatma yolları
- Kullanıcı girdisinden kod çalıştırma (`/kod-calistir` sandbox'ı) kaçışları
- Discord izinlerinin (moderasyon komutları, `requirePermission()`) atlatılması

## Kapsam dışı

- `data/` klasöründeki kendi sunucu verinizin yönetimi (bu sizin sorumluluğunuz, `.gitignore` ile zaten korunuyor)
- Üçüncü taraf servislerin (Discord, AI sağlayıcıları, yt-dlp, Fish Audio vb.) kendi güvenlik açıkları
