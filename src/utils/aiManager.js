// OpenClaw & Cloud AI (Groq / OpenRouter Fallback) İstemcisi ve Eylem Yürütücüsü
const { executeAction } = require('./aiActionExecutor');
const { getKnowledgePromptSnippet } = require('./customSkillManager');
const { getSettings } = require('./database');
const { getPersona } = require('./aiPersonas');
const { sendServerLog } = require('./serverLog');
const logger = require('./logger');

// Log kanalına düşürülecek, denetim açısından önemli eylemler.
// ban_member burada YOK: guildBanAdd native event'i (manuel banlar dahil) zaten yakalıyor, çift kayıt olmasın diye.
const LOGGED_ACTIONS = new Set([
    'kick_member', 'timeout_member', 'remove_timeout',
    'purge_messages', 'clear_channels', 'delete_all_channels', 'bulk_delete_channels', 'delete_channel',
    'clear_roles', 'delete_roles', 'delete_roles_matching', 'delete_all_roles', 'bulk_delete_roles', 'delete_role',
    'apply_theme', 'create_channel', 'bulk_create_channels', 'create_category', 'bulk_create_categories',
    'create_role', 'bulk_create_roles', 'organize_channels'
]);

const conversationHistory = new Map(); // contextId -> Array of { role, content, timestamp }

// 30 dakikadan eski konuşma geçmişlerini otomatik temizleme
const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, messages] of conversationHistory.entries()) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && now - lastMsg.timestamp > 30 * 60 * 1000) {
            conversationHistory.delete(id);
        }
    }
}, 5 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

function cleanThinkTags(text) {
    if (!text) return '';
    // 1. Kapalı <think>...</think> bloklarını temizle
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    // 2. Token kesilmesi yüzünden kapanmamış <think>... varsa hepsini kazı
    if (cleaned.includes('<think>')) {
        cleaned = cleaned.replace(/<think>[\s\S]*/gi, '').trim();
    }
    return cleaned;
}

function extractActions(text) {
    if (!text) return null;

    // 1. ```action ... ``` veya ```json ... ``` kod bloklarını ara
    const blockMatch = text.match(/```(?:action|json)?\s*([\s\S]*?)\s*```/i);
    let target = blockMatch ? blockMatch[1] : text;

    // 2. JS / JSON yorumlarını temizle
    target = target.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();

    // 3. JSON dizisi veya objesi sınırlarını bul
    const firstBracket = target.indexOf('[');
    const firstBrace = target.indexOf('{');
    let jsonStr = null;

    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
        const lastBracket = target.lastIndexOf(']');
        if (lastBracket > firstBracket) {
            jsonStr = target.substring(firstBracket, lastBracket + 1);
        }
    } else if (firstBrace !== -1) {
        const lastBrace = target.lastIndexOf('}');
        if (lastBrace > firstBrace) {
            jsonStr = target.substring(firstBrace, lastBrace + 1);
        }
    }

    if (!jsonStr) return null;

    // 4. Trailing virgülleri ve akıllı tırnakları düzelt
    const cleanJson = jsonStr
        .replace(/,\s*([\}\]])/g, '$1')
        .replace(/[\u201C\u201D]/g, '"');

    try {
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed)) {
            const valid = parsed.filter(item => item && (item.action || item.actions));
            return valid.length > 0 ? valid : null;
        }
        if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.actions)) {
                return parsed.actions.length > 0 ? parsed.actions : null;
            }
            if (parsed.action) {
                return [parsed];
            }
        }
    } catch (err) {
        // Yedek: Regex ile action objesini yakalamaya çalış
        const singleActionMatch = cleanJson.match(/\{\s*"action"\s*:\s*"([^"]+)"(?:\s*,\s*"params"\s*:\s*(\{[\s\S]*?\}))?\s*\}/i);
        if (singleActionMatch) {
            const actionName = singleActionMatch[1];
            let params = {};
            if (singleActionMatch[2]) {
                try { params = JSON.parse(singleActionMatch[2]); } catch (_) {}
            }
            return [{ action: actionName, params }];
        }
    }

    return null;
}

// Spam / gereksiz API maliyeti önleme: kullanıcı başına basit istek aralığı.
// Cooldown içindeyse kalan ms döner (0 = izinli, aynı zamanda isteği "kullanılmış" olarak işaretler).
const AI_COOLDOWN_MS = 4000;
const lastAiRequestAt = new Map(); // userId -> timestamp
function checkAiCooldown(userId) {
    const now = Date.now();
    const last = lastAiRequestAt.get(userId);
    if (last && now - last < AI_COOLDOWN_MS) {
        return AI_COOLDOWN_MS - (now - last);
    }
    lastAiRequestAt.set(userId, now);
    return 0;
}

// Gemini -> OpenClaw -> Groq -> OpenRouter sırasıyla dener, ilk başarılı ham yanıtı döndürür.
// askOpenClaw (roleplay sohbet) ve generateJSON (saf yapılandırılmış çıktı) bu ortak mantığı paylaşır.
async function callAIProviders(messages, keys = {}, isVoice = false) {
    let rawReply = null;

    const geminiKey = keys.geminiKey || process.env.GEMINI_API_KEY;
    const openclawUrl = keys.openclawUrl || (process.env.OPENCLAW_BASE_URL || 'http://127.0.0.1:18789/v1').replace(/\/+$/, '');
    const openclawApiKey = keys.openclawApiKey || process.env.OPENCLAW_API_KEY;
    const groqKey = keys.groqKey || process.env.GROQ_API_KEY;
    const mistralKey = process.env.MISTRAL_API_KEY;
    const zhipuaiKey = process.env.ZHIPUAI_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const sambanovaKey = process.env.SAMBANOVA_API_KEY;
    const cerebrasKey = process.env.CEREBRAS_API_KEY;
    const openrouterKey = keys.openrouterKey || process.env.OPENROUTER_API_KEY;
    const isVoicePrompt = isVoice || messages.some(m => typeof m.content === 'string' && m.content.includes('CANLI SESLİ'));

    // 1. SESLİ GÖRÜŞME İÇİN ÖNCELİK: Groq LPU Ultra Hızlı Motor (~35ms Gecikme)
    if (isVoicePrompt && groqKey) {
        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${groqKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'qwen/qwen3.8-27b',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 150
                })
            });
            if (res.ok) {
                const data = await res.json();
                rawReply = data.choices?.[0]?.message?.content;
            }
        } catch (err) {
            console.error('Groq Ses Hatası:', err.message);
        }
    }

    // 2. OpenClaw Ağ Geçidi (Metin Sohbetleri İçin Birincil Tercih)
    if (!rawReply && openclawUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const headers = { 'Content-Type': 'application/json' };
            if (openclawApiKey) headers['Authorization'] = `Bearer ${openclawApiKey}`;

            const response = await fetch(`${openclawUrl}/chat/completions`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: process.env.OPENCLAW_MODEL || 'openclaw',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: isVoice ? 150 : 1000
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                rawReply = data.choices?.[0]?.message?.content;
            }
        } catch {
            // OpenClaw yanıt vermezse diğer servislere geç
        }
    }

    // 2. Google Gemini
    if (!rawReply && geminiKey) {
        try {
            const systemMsg = messages.find(m => m.role === 'system');
            const geminiContents = messages
                .filter(m => m.role !== 'system')
                .map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                }));

            let geminiModel = (process.env.GEMINI_MODEL || 'gemini-flash-latest').trim().toLowerCase().replace(/\s+/g, '-');
            const requestBody = JSON.stringify({
                systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
                contents: geminiContents,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1500
                }
            });

            let geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: requestBody
            });

            // Model adı bulunamazsa veya 404 dönerse en güncel kararlı sürümle tekrar dene
            // (sabit versiyon numarası yerine "-latest" alias'ı kullanıyoruz ki bu retry kendisi de zamanla küflenmesin)
            if (!geminiRes.ok && geminiModel !== 'gemini-flash-latest') {
                const retryRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: requestBody
                });
                if (retryRes.ok) {
                    geminiRes = retryRes;
                }
            }

            if (geminiRes.ok) {
                const geminiData = await geminiRes.json();
                rawReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            } else {
                console.warn('Gemini API Hatası:', await geminiRes.text());
            }
        } catch (err) {
            console.error('Gemini İstek Hatası:', err);
        }
    }

    // 2. Groq LPU (Ultra Hızlı ~150ms Yanıt Motoru)
    if (!rawReply && groqKey) {
        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${groqKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'qwen/qwen3.8-27b',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 800
                })
            });
            if (res.ok) {
                const data = await res.json();
                rawReply = data.choices?.[0]?.message?.content;
            }
        } catch (err) {
            console.error('Groq Hatası:', err.message);
        }
    }

    // 3. Mistral AI (Doğrulanmış ve Hızlı)
    if (!rawReply && mistralKey) {
        try {
            const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${mistralKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'mistral-small-latest',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });
            if (res.ok) {
                const data = await res.json();
                rawReply = data.choices?.[0]?.message?.content;
            }
        } catch (err) {
            console.error('Mistral Hatası:', err.message);
        }
    }

    // 3. ZhipuAI / GLM (Doğrulanmış ve Hızlı)
    if (!rawReply && zhipuaiKey) {
        try {
            const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${zhipuaiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'glm-4-flash',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });
            if (res.ok) {
                const data = await res.json();
                rawReply = data.choices?.[0]?.message?.content;
            }
        } catch (err) {
            console.error('ZhipuAI Hatası:', err.message);
        }
    }

    // 4. Groq (qwen3.6-27b)
    if (!rawReply && groqKey) {
        try {
            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${groqKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'qwen/qwen3.6-27b',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });

            if (groqRes.ok) {
                const groqData = await groqRes.json();
                rawReply = groqData.choices?.[0]?.message?.content;
            }
        } catch (err) {
            console.error('Groq Hatası:', err);
        }
    }

    // 5. OpenClaw Ağ Geçidi
    if (!rawReply && openclawUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const headers = { 'Content-Type': 'application/json' };
            if (openclawApiKey) headers['Authorization'] = `Bearer ${openclawApiKey}`;

            const response = await fetch(`${openclawUrl}/chat/completions`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: process.env.OPENCLAW_MODEL || 'openclaw',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 350
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                rawReply = data.choices?.[0]?.message?.content;
            }
        } catch {
            // OpenClaw yanıt vermezse yedek servise geç
        }
    }

    // 6. DeepSeek
    if (!rawReply && deepseekKey) {
        try {
            const res = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${deepseekKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });
            if (res.ok) {
                const data = await res.json();
                rawReply = data.choices?.[0]?.message?.content;
            }
        } catch (err) {}
    }

    // 7. SambaNova
    if (!rawReply && sambanovaKey) {
        try {
            const res = await fetch('https://api.sambanova.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sambanovaKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'Meta-Llama-3.3-70B-Instruct',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });
            if (res.ok) {
                const data = await res.json();
                rawReply = data.choices?.[0]?.message?.content;
            }
        } catch (err) {}
    }

    // 8. Cerebras (ücretsiz katmanı olan, çok hızlı bir çıkarım motoru)
    if (!rawReply && cerebrasKey) {
        try {
            const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${cerebrasKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });
            if (res.ok) {
                const data = await res.json();
                rawReply = data.choices?.[0]?.message?.content;
            }
        } catch (err) {
            console.error('Cerebras Hatası:', err.message);
        }
    }

    // 9. OpenRouter
    if (!rawReply && openrouterKey) {
        try {
            const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openrouterKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'openrouter/auto',
                    messages: messages
                })
            });

            if (orRes.ok) {
                const orData = await orRes.json();
                rawReply = orData.choices?.[0]?.message?.content;
            }
        } catch (err) {
            console.error('OpenRouter Hatası:', err);
        }
    }

    return rawReply;
}

// Roleplay/persona kısıtlamalarından bağımsız saf JSON üretimi.
// askOpenClaw'daki sistem promptu "cevap max 5-10 kelime" gibi sohbet kuralları içerir;
// tema-ai-olustur gibi büyük yapılandırılmış çıktı isteyen komutlar bunu KULLANMAMALI,
// aksi halde model kısıtlamalarla çakışıp geçersiz/eksik JSON üretir.
async function generateJSON(userPrompt, systemPrompt) {
    const keys = {
        geminiKey: process.env.GEMINI_API_KEY || '',
        openclawUrl: (process.env.OPENCLAW_BASE_URL || 'http://127.0.0.1:18789/v1').replace(/\/+$/, ''),
        openclawApiKey: process.env.OPENCLAW_API_KEY || '',
        groqKey: process.env.GROQ_API_KEY || '',
        openrouterKey: process.env.OPENROUTER_API_KEY || ''
    };

    const messages = [
        {
            role: 'system',
            content: systemPrompt || 'Sen bir JSON üretici asistansın. Kullanıcının isteğine göre SADECE geçerli JSON döndür; markdown, açıklama veya rol yapma metni ekleme.'
        },
        { role: 'user', content: userPrompt }
    ];

    const rawReply = await callAIProviders(messages, keys);
    return rawReply ? cleanThinkTags(rawReply) : null;
}

async function askOpenClaw(contextId, userPrompt, userName = 'Kullanıcı', context = null) {
    const openclawUrl = (process.env.OPENCLAW_BASE_URL || 'http://127.0.0.1:18789/v1').replace(/\/+$/, '');
    const openclawApiKey = process.env.OPENCLAW_API_KEY || '';
    const groqKey = process.env.GROQ_API_KEY || '';
    const openrouterKey = process.env.OPENROUTER_API_KEY || '';
    const geminiKey = process.env.GEMINI_API_KEY || '';

    // Geçmişi al veya yeni oluştur
    let history = conversationHistory.get(contextId) || [];

    const knowledgeSnippet = context?.guild ? getKnowledgePromptSnippet(context.guild.id) : '';
    const guildSettings = context?.guild ? getSettings(context.guild.id) : {};
    const activePersona = getPersona(guildSettings.aiPersona || 'gemini');

    // Gelişmiş sistem mesajı (Sohbet + Discord Sunucu Mimarı / Function Calling)
    const systemMessage = {
        role: 'system',
        content: `Sen bu Discord sunucusunun yapay zeka yöneticisi ve mimarısın.
${contextId && contextId.startsWith('voice-') ? `
🎙️ CANLI SESLİ GÖRÜŞME DİREKTİFİ:
- Kullanıcı seninle ses kanalında mikrofonla canlı konuşuyor ve cevabın Fish Audio ile seslendirilecek.
- CEVAPLARIN MUTLAKA 1-2 CÜMLE, KISA, DOĞAL VE AKICI KONUŞMA DİLİYLE OLMALI.
- ASLA markdown (*, _, #, \`, ~), liste işaretleri (•, 1., 2.), link veya emoji KULLANMA.
- Aktif Kişilik Modun: ${activePersona.name} (${activePersona.tag})! Bu kişiliğin ruhunu, ses tonunu, cilvesini, esprisini veya tavrını sesli konuşmanda BİREBİR yaşat.
${activePersona.id === 'flirt' ? '- FLÖRTÖZ SESLİ SOHBET: Kullanıcıyla sesli konuşurken son derece tatlı, cilveli, sıcak, iltifatkar ve çapkın konuş. Karşındakine ismiyle veya tatlı hitaplarla (canım, tatlım, hayatım vb.) seslen, neşeli, tatlı ve çekici bir flört havası yarat!' : ''}
` : ''}
${activePersona.identityPrompt}

⚠️ KURALLAR:
1. DİL: SADECE TÜRKÇE konuşacaksın.
2. CEVAP UZUNLUĞU: Sohbet cevaplarını kısa ve öz tut (genelde 1-3 cümle); gerektiğinde (bilgi/açıklama isteniyorsa) daha uzun yazabilirsin ama gereksiz uzatma.
3. KESİNLİKLE YASAKLI ROBOTİK KALIP: "İsteğinizi aldım", "Hemen hallediyorum", "Tabii ki efendim" kalıplarını ASLA KULLANMA.
4. SOHBETTE: Kullanıcı sana bir şey sorduğunda doğal, samimi ve persona'nın tonuna uygun cevap ver.
5. ALTYAPI / ŞİRKET İSMİ: Persona kimliğinde aksi belirtilmedikçe "Google", "Gemini", "altyapısıyla" gibi ifadeleri kullanma; kendini sunucunun AI yöneticisi olarak tanıt.
6. EYLEM/KOMUT İSTENDİĞİNDE (TOPLU VE ÇOKLU ÇALIŞMA — ÖNCELİK BUDUR):
Kullanıcı "kanalları düzenle", "rolleri kur", "temayı aç" gibi birden fazla nesneyi ilgilendiren bir şey istediğinde ASLA TEK TEK, TEK BİR ÖĞE İÇİN action üretme! Önce ne kadar kanal/rol/kategori gerektiğini düşün, HEPSİNİ TEK SEFERDE bulk_* eylemleriyle (bulk_create_categories, bulk_create_channels, bulk_create_roles, bulk_delete_channels, bulk_delete_roles) veya apply_theme/organize_channels gibi toplu eylemlerle yap. "5 kanal aç" dendiğinde create_channel'ı 5 kere değil, bulk_create_channels'ı 5 kanalla BİR KERE çağır.
Birden fazla işlem istendiğinde veya sunucuyu düzenlerken ASLA TEK TEK YAPMA!
Hepsini tek bir action bloğunda dizi (Array) olarak oluştur:
\`\`\`action
[
  {"action": "bulk_create_categories", "params": {"categories": [{"name": "Bilgilendirme", "channels": [{"name": "kurallar", "type": "text"}, {"name": "duyurular", "type": "text"}]}, {"name": "Sohbet", "channels": [{"name": "genel", "type": "text"}, {"name": "Sohbet Odası", "type": "voice"}]}]}},
  {"action": "bulk_create_roles", "params": {"roles": [{"name": "Yönetici", "color": "#FF0000"}, {"name": "Moderatör", "color": "#00FF00"}, {"name": "Üye", "color": "#00AAFF"}]}},
  {"action": "send_rules", "params": {}}
]
\`\`\`
Tek bir işlem varsa tek bir obje de oluşturabilirsin:
\`\`\`action
{"action": "EYLEM_ADI", "params": { ... }}
\`\`\`

KULLANABİLECEĞİN TOPLU VE TEKLİ EYLEMLER:
1. 🎨 TEMA VE GENEL KURULUM:
   - apply_theme: {"theme_id": "gaming" | "dev" | "chill" | "anime" | "study" | "design" | "music", "wipe": boolean}
   - organize_channels: {} (Tüm kanalları kategorilere ayırıp düzenler)

2. 📁 TOPLU KANAL VE KATEGORİ:
   - bulk_create_categories: {"categories": [{"name": "Kategori Adı", "channels": [{"name": "kanal-1", "type": "text" | "voice"}]}]}
   - bulk_create_channels: {"channels": [{"name": "kanal-adi", "type": "text" | "voice", "category": "Kategori Adı"}]}
   - bulk_delete_channels: {"keyword": "tüm" | "kelime", "names": ["kanal1", "kanal2"]}
   - create_category: {"name": "Kategori Adı"}
   - create_channel: {"name": "kanal-adi", "type": "text" | "voice"}
   - delete_channel: {"channel_name": "kanal-adi"}
   - hide_channel: {} | unhide_channel: {} | lock_channel: {} | unlock_channel: {}
   - set_channel_topic: {"topic": "Açıklama"} | set_slowmode: {"seconds": 5}

3. 🛡️ TOPLU VE TEKLİ ROL YÖNETİMİ:
   - bulk_create_roles: {"roles": [{"name": "Kurucu", "color": "#FF0000"}, {"name": "Admin", "color": "#00FF00"}, {"name": "Üye", "color": "#0088FF"}]}
   - bulk_delete_roles: {"keyword": "tüm" | "burç" | "renk", "names": ["Rol1", "Rol2"]}
   - create_role: {"name": "VIP", "color": "#FFD700"}
   - delete_role: {"role_name": "Rol Adı"}
   - clear_roles: {}
   - add_role_to_user: {"user": "kullanici_adi", "role": "Rol Adı"}
   - remove_role_from_user: {"user": "kullanici_adi", "role": "Rol Adı"}

4. 🛡️ ÜYE VE MODERASYON İŞLEMLERİ:
   - ban_member: {"user": "kullanici_adi", "reason": "sebep"}
   - kick_member: {"user": "kullanici_adi", "reason": "sebep"}
   - timeout_member: {"user": "kullanici_adi", "minutes": 10, "reason": "sebep"}
   - remove_timeout: {"user": "kullanici_adi"}
   - change_nickname: {"user": "kullanici_adi", "nickname": "Yeni İsim"}
   - purge_messages: {"count": 10}
   - warn_member: {"user": "kullanici_adi", "reason": "sebep"} (3 uyarıda otomatik 10dk susturma)
   - list_warnings: {"user": "opsiyonel"} | clear_warnings: {"user": "kullanici_adi"}

5. 📢 DUYURU VE ANKET:
   - send_announcement: {"title": "Başlık", "message": "Duyuru İçeriği", "channel_name": "duyurular"}
   - create_poll: {"question": "Anket Sorusu?", "options": ["Seçenek 1", "Seçenek 2"]}
   - send_rules: {}| unhide_channel: {}
   - lock_channel: {} | unlock_channel: {}
   - set_slowmode: {"seconds": 5}
   - organize_channels: {}
   - send_rules: {}

5. ⚙️ SUNUCU, BOT VE EĞLENCE:
   - set_server_name: {"name": "Yeni Sunucu Adı"}
   - set_bot_activity: {"activity": "Valorant"}
   - random_user: {}
   - flip_coin: {} | roll_dice: {"sides": 6}
   - create_role: {"name": "VIP"}
   - purge_messages: {"count": 10}

6. 🎵 MÜZİK VE GEÇİCİ ODA:
   - play_music: {"query": "şarkı adı veya linki"}
   - pause_music: {} | resume_music: {} | skip_music: {} | stop_music: {} | show_queue: {}
   - set_music_volume: {"level": 0-200} | toggle_music_loop: {} | shuffle_music_queue: {}
   - show_lyrics: {} (çalan şarkının sözlerini gösterir)
   - set_music_effect: {"effect": "bassboost" | "nightcore" | "none"}
   - vote_skip_music: {} (kullanıcının kendisi oy verir, çoğunluk sağlanınca şarkı atlanır)
   - lock_room: {} | unlock_room: {} | rename_room: {"name": "Oda Adı"} | set_room_limit: {"limit": 4} | server_info: {}

7. 🧠 YENİ ÖZELLİK VE BİLGİ ÖĞRENME:
   - add_custom_command: {"trigger": "kelime", "response": "otomatik verilecek cevap"}
   - learn_knowledge: {"topic": "Konu", "content": "Kural veya Bilgi"}
   - list_custom_skills: {}
   - remove_custom_skill: {"name": "kelime"}

8. 🎙️ SES BOTU VE CANLI RADYO:
   - play_radio: {"station": "powerturk" | "fenomen" | "slowturk" | "bestfm" | "lofi"}
   - stay_in_voice: {"channel_name": "kanal"} (7/24 seste kalır)
   - leave_voice: {} (Sesten çıkar)
   - play_tts: {"text": "okunacak mesaj"} (Seste okur)
   - join_and_listen: {} ("sesliye gel", "gel sesliye", "sesle konuşalım", "seninle konuşmak istiyorum" gibi isteklerde MUTLAKA bunu kullan; kullanıcının bulunduğu ses kanalına katılır ve sesle komut dinlemeyi başlatır — kullanıcı konuştukça yazıya çevirip yanıtlar ve yanıtı sesle geri okur)
   - stop_listening: {} ("dinlemeyi bırak", "sesli komutu kapat", "artık dinleme")

9. 🎭 YAPAY ZEKA MODU VE KİŞİLİK (system_prompts_repo):
   - set_ai_persona: {"persona": "gemini" | "flirt" | "claude" | "gpt" | "grok" | "deepseek" | "perplexity" | "cursor" | "qwen"}
   - list_ai_personas: {}

10. 📋 LOG SİSTEMİ:
   - setup_log_channel: {"channel_name": "opsiyonel, mevcut kanal adı"} (ban/kick/mesaj-silme/kanal-rol değişikliklerini kaydedecek kanalı ayarlar; kanal verilmezse "log" geçen bir kanal arar, bulamazsa yeni açar. ZATEN AYARLIYSA TEKRAR ÇAĞIRMA, aynı isteği iki kere yazsa bile fonksiyon zaten tekrar kanal açmaz.)
   ⚠️ "log kanalı aç/oluştur/kur" gibi isteklerde SAKIN create_channel veya create_category kullanma, MUTLAKA setup_log_channel kullan; aksi halde log sistemine bağlı olmayan işe yaramaz bir kanal açılır.

11. 🛡️ OTOMATİK MODERASYON (Otomod):
   - toggle_automod: {"enabled": true | false}
   - automod_add_word: {"word": "kelime"} | automod_remove_word: {"word": "kelime"} | automod_list_words: {}
   - automod_block_invites: {"block": true | false}
   - automod_set_spam_threshold: {"count": 5, "seconds": 5}

12. 📝 KAYIT SİSTEMİ:
   - setup_registration: {"channel_name": "opsiyonel"} ("kayıt sistemi kur", "hoşgeldin odası aç" gibi isteklerde kullan; hoşgeldin kanalı + kayıtsız/kayıtlı rollerini otomatik oluşturur ve butonlu kayıt akışını aktif eder. Zaten kuruluysa gerekmedikçe tekrar çağırma.)

13. ℹ️ YETENEKLER, YEDEKLEME, SEVİYE, DAVET:
   - show_capabilities: {} ("neler yapabilirsin", "yeteneklerin ne" gibi sorularda MUTLAKA bunu kullan, kendi kendine liste uydurma)
   - create_backup: {} ("yedek al", "sunucuyu yedekle")
   - check_level: {"user": "opsiyonel, kullanıcı adı"} ("seviyem ne", "kaçıncı seviyedeyim")
   - get_invite_link: {} ("davet linki", "seni başka sunucuya nasıl eklerim", "beni ekle" gibi isteklerde MUTLAKA bunu kullan, linki UYDURMA)
   - setup_server_stats: {} ("istatistik kanalları kur", "üye sayacı oluştur") | remove_server_stats: {}
   - get_moderation_history: {"user": "kullanici_adi"} ("moderasyon geçmişi", "ban/kick geçmişi")
   - setup_starboard: {"channel_name": "opsiyonel", "threshold": 3, "emoji": "⭐"} ("starboard kur", "yıldızlı mesajlar")
   - set_birthday: {"month": 1-12, "day": 1-31} ("doğum günüm X", "doğum günümü kaydet")

14. 💰 EKONOMİ, ⏰ HATIRLATICI, 💤 AFK:
   - get_balance: {"user": "opsiyonel"} ("bakiyem ne", "param ne kadar", "kaç param var")
   - claim_daily: {} ("günlük ödülümü al", "günlük al")
   - set_reminder: {"duration": "10dk/2saat/1gun formatında", "message": "hatırlatma metni"} ("bana 10 dakika sonra X diye hatırlat", "1 saat sonra hatırlat")
   - set_afk: {"reason": "opsiyonel sebep"} ("afk oluyorum", "uzaklaşıyorum", "afk moduna geç")
${knowledgeSnippet}

Normal sohbette action bloğu EKLEME.`
    };

    history.push({
        role: 'user',
        content: `${userName}: ${userPrompt}`,
        timestamp: Date.now()
    });

    if (history.length > 6) {
        history = history.slice(-6);
    }
    conversationHistory.set(contextId, history);

    const isVoice = typeof contextId === 'string' && contextId.startsWith('voice-');
    if (isVoice) {
        systemMessage.content = `🎙️ CANLI SESLİ GÖRÜŞME DİREKTİFİ:
Kullanıcıyla ses kanalında canlı konuşuyorsun.
KİŞİLİK: ${activePersona.id === 'flirt' ? 'Aşırı tatlı dilli, cilveli, flörtöz, sevecen ve neşeli.' : 'Samimi, canlı ve arkadaş canlısı.'}
KURALLAR:
1. Yanıtın TAM 1 KISA CÜMLE (en fazla 2 kısa cümle) olmalı!
2. Doğal konuşma dilinde olmalı, sanki telefonda konuşuyormuş gibi canlı, akıcı ve samimi ol.
3. Asla markdown, madde işareti, emoji veya garip noktalama işaretleri kullanma.`;
    }

    const messages = [
        systemMessage,
        ...history.map(m => ({ role: m.role, content: m.content }))
    ];

    let rawReply = await callAIProviders(messages, { geminiKey, openclawUrl, openclawApiKey, groqKey, openrouterKey }, isVoice);

    if (!rawReply) {
        return '❌ Yapay zeka servislerine şu anda ulaşılamıyor. Lütfen API anahtarlarınızı kontrol edin.';
    }

    rawReply = cleanThinkTags(rawReply);

    // Eylem (Action) Algılama ve Yürütme
    let finalReply = rawReply;
    let actionList = extractActions(rawReply);

    // Akıllı Niyet Tespiti (Intent Fallback): Model eylem bloğu yazmasa dahi sunucu komutlarını kaçırmaz
    if ((!actionList || actionList.length === 0) && userPrompt) {
        const lp = userPrompt.toLowerCase().trim();
        let fallbackAction = null;

        if ((lp.includes('burç') || lp.includes('burc')) && (lp.includes('sil') || lp.includes('kaldır'))) {
            fallbackAction = { action: 'delete_roles', params: { keyword: 'burç' } };
        } else if (lp.includes('rolleri sil') || lp.includes('tüm rolleri sil') || lp.includes('rolleri temizle')) {
            fallbackAction = { action: 'delete_roles', params: { keyword: 'tüm' } };
        } else if (lp.includes('kanalları sil') || lp.includes('tüm kanalları sil') || lp.includes('kanalları temizle')) {
            fallbackAction = { action: 'clear_channels', params: {} };
        } else if (lp.match(/(\d+)\s*(?:adet\s*)?mesaj\s*(?:sil|temizle)/i)) {
            const count = parseInt(lp.match(/(\d+)/)[1]) || 10;
            fallbackAction = { action: 'purge_messages', params: { count } };
        } else if (lp.includes('moduna geç') || lp.includes('moduna gec') || lp.includes('modunu aç') || lp.includes('modu yap') || lp.includes('moduna dön')) {
            for (const p of ['flirt', 'flört', 'flort', 'flörtöz', 'flortoz', 'romantik', 'çapkın', 'capkin', 'grok', 'claude', 'gemini', 'gpt', 'deepseek', 'perplexity', 'cursor', 'qwen', 'doom']) {
                if (lp.includes(p)) {
                    const normalizedPersona = ['flirt', 'flört', 'flort', 'flörtöz', 'flortoz', 'romantik', 'çapkın', 'capkin'].includes(p) ? 'flirt' : p;
                    fallbackAction = { action: 'set_ai_persona', params: { persona: normalizedPersona } };
                    break;
                }
            }
        } else if (lp.includes('modları listele') || lp.includes('ai modları') || lp.includes('hangi modlar var')) {
            fallbackAction = { action: 'list_ai_personas', params: {} };
        } else if (lp.match(/(?:log\w*|denetim\s*kayd\w*)\s*(?:kanal\w*|sistem\w*)?\s*(?:kur|oluştur|olustur|aç|ac|ayarla|bağla|başlat)/i) || lp.includes('log kanalı') || lp.includes('logların kanalı')) {
            fallbackAction = { action: 'setup_log_channel', params: {} };
        } else if (lp.match(/(oto\s*mod|otomod)\w*\s*(aç|ac|başlat|baslat|aktif)/i)) {
            fallbackAction = { action: 'toggle_automod', params: { enabled: true } };
        } else if (lp.match(/(oto\s*mod|otomod)\w*\s*(kapat|durdur|pasif|devre\s*dışı)/i)) {
            fallbackAction = { action: 'toggle_automod', params: { enabled: false } };
        } else if (lp.match(/davet\s*link\w*\s*(engelle|yasakla|kapat)/i)) {
            fallbackAction = { action: 'automod_block_invites', params: { block: true } };
        } else if (lp.match(/davet\s*link\w*\s*(serbest|aç|ac|izin)/i)) {
            fallbackAction = { action: 'automod_block_invites', params: { block: false } };
        } else if (lp.match(/(kayıt|kayit)\s*sistem\w*\s*(kur|oluştur|olustur|aç|ac)/i) || lp.match(/hoş\s*geldin\s*od\w*\s*(oluştur|olustur|aç|ac|kur)/i)) {
            fallbackAction = { action: 'setup_registration', params: {} };
        } else if (lp.match(/(neler|ne)\s*yapabil\w*|yetenekle?rin?\s*ne|nelere?\s*yardımcı/i)) {
            fallbackAction = { action: 'show_capabilities', params: {} };
        } else if (lp.match(/(yedek|backup)\s*al|sunucuyu\s*yedekle/i)) {
            fallbackAction = { action: 'create_backup', params: {} };
        } else if (lp.match(/seviyem\s*ne|kaçıncı\s*seviye|kacinci\s*seviye/i)) {
            fallbackAction = { action: 'check_level', params: {} };
        } else if (lp.match(/davet\s*link\w*|beni\s*(başka\s*sunucuya\s*)?ekle|seni\s*(sunucuya|nasıl)\s*ekle/i)) {
            fallbackAction = { action: 'get_invite_link', params: {} };
        } else if (lp.match(/istatistik\s*(kanal\w*)?\s*(kur|oluştur|olustur|aç|ac)|üye\s*sayac\w*\s*(kur|oluştur|olustur)/i)) {
            fallbackAction = { action: 'setup_server_stats', params: {} };
        } else if (lp.match(/starboard\s*(kur|oluştur|olustur|aç|ac)/i)) {
            fallbackAction = { action: 'setup_starboard', params: {} };
        } else if (lp.match(/moderasyon\s*geçmiş\w*|ban\s*\/?\s*kick\s*geçmiş\w*/i)) {
            fallbackAction = { action: 'get_moderation_history', params: {} };
        } else if (lp.match(/doğum\s*günüm\s*(\d{1,2})[.\/\s]+(\d{1,2})/i)) {
            const m = lp.match(/doğum\s*günüm\s*(\d{1,2})[.\/\s]+(\d{1,2})/i);
            fallbackAction = { action: 'set_birthday', params: { day: m[1], month: m[2] } };
        } else if (lp.match(/bakiyem\s*ne|param\s*ne\s*kadar|kaç\s*param\s*var|kac\s*param\s*var/i)) {
            fallbackAction = { action: 'get_balance', params: {} };
        } else if (lp.match(/günlük\s*(ödül\w*)?\s*al|gunluk\s*(odul\w*)?\s*al/i)) {
            fallbackAction = { action: 'claim_daily', params: {} };
        } else if (lp.match(/afk\s*(moduna|ya|'?a)?\s*(geç|geciyorum|gecıyorum|oluyorum|ol)/i)) {
            const reasonMatch = lp.match(/afk[^:]*:\s*(.+)/i);
            fallbackAction = { action: 'set_afk', params: { reason: reasonMatch ? reasonMatch[1].trim() : '' } };
        } else if (lp.match(/(\d+)\s*(sn|saniye|dk|dakika|saat|sa|gun|gün|g)\s*(sonra)?\s*(bana\s*)?(.+?)\s*(diye\s*)?hatırlat/i)) {
            const m = lp.match(/(\d+)\s*(sn|saniye|dk|dakika|saat|sa|gun|gün|g)\s*(sonra)?\s*(bana\s*)?(.+?)\s*(diye\s*)?hatırlat/i);
            fallbackAction = { action: 'set_reminder', params: { duration: `${m[1]}${m[2]}`, message: (m[5] || 'hatırlatma').trim() } };
        } else if (lp.match(/(?:biri|kullanıcı)\s+["']?([^"']+)["']?\s+(?:yazarsa|derse|söylerse)\s+["']?([^"']+)["']?\s+(?:de|yaz|cevap ver|söyle)/i)) {
            const m = lp.match(/(?:biri|kullanıcı)\s+["']?([^"']+)["']?\s+(?:yazarsa|derse|söylerse)\s+["']?([^"']+)["']?\s+(?:de|yaz|cevap ver|söyle)/i);
            fallbackAction = { action: 'add_custom_command', params: { trigger: m[1].trim(), response: m[2].trim() } };
        } else if (lp.startsWith('öğren:') || lp.startsWith('ogren:') || lp.startsWith('şunu öğren:') || lp.startsWith('yeni kural:')) {
            const rawContent = userPrompt.replace(/^(?:öğren:|ogren:|şunu\s+öğren:|yeni\s+kural:)\s*/i, '').trim();
            fallbackAction = { action: 'learn_knowledge', params: { topic: 'Kural/Bilgi', content: rawContent } };
        } else if (lp.includes('öğrendiğin bilgileri listele') || lp.includes('özel yetenekleri listele') || lp.includes('özellikleri listele')) {
            fallbackAction = { action: 'list_custom_skills', params: {} };
        } else if (lp.includes('sesliye gel') || lp.includes('sesle konuş') || lp.includes('sesli konuş') || lp.includes('sesli komutu aç') || lp.includes('sesli komutu başlat') || lp.includes('seninle konuşmak istiyorum') || lp.includes('benimle konuş')) {
            fallbackAction = { action: 'join_and_listen', params: {} };
        } else if (lp.includes('sesli komutu kapat') || lp.includes('sesli komutu durdur') || lp.includes('dinlemeyi bırak') || lp.includes('dinlemeyi durdur')) {
            fallbackAction = { action: 'stop_listening', params: {} };
        } else if (lp.includes('sese gel') || lp.includes('ses kanalına gel') || lp.includes('bize katıl') || lp.includes('odaya gel') || lp.includes('sese katıl')) {
            fallbackAction = { action: 'stay_in_voice', params: {} };
        } else if (lp.match(/(?:sesten|seslden|kanaldan|odadan|sesli\s*(?:sohbetten|odadan)?)\s*(?:ayrıl|ayril|çık|cik|git|kapat|bırak|birak)/i) || lp.includes('sesten çık') || lp.includes('sesten ayrıl') || lp.includes('odadan çık') || lp.includes('odadan ayrıl') || lp.includes('seslden ayrıl')) {
            fallbackAction = { action: 'leave_voice', params: {} };
        } else if (lp.match(/(?:müzik\s+çal|şarkı\s+çal|şarkı\s+aç|oynat|çal)\s*[:\s]+(.+)/i)) {
            const song = lp.match(/(?:müzik\s+çal|şarkı\s+çal|şarkı\s+aç|oynat|çal)\s*[:\s]+(.+)/i)[1].trim();
            fallbackAction = { action: 'play_music', params: { query: song } };
        } else if (lp.includes('müziği durdur') || lp.includes('şarkıyı durdur') || lp.includes('müziği kapat')) {
            fallbackAction = { action: 'stop_music', params: {} };
        } else if (lp.includes('müziği duraklat') || lp.includes('şarkıyı duraklat')) {
            fallbackAction = { action: 'pause_music', params: {} };
        } else if (lp.includes('devam et') || lp.includes('devam ettir') || lp.includes('müziği devam ettir')) {
            fallbackAction = { action: 'resume_music', params: {} };
        } else if (lp.includes('şarkıyı geç') || lp.includes('sıradaki şarkı') || lp.includes('şarkı atla')) {
            fallbackAction = { action: 'skip_music', params: {} };
        } else if (lp.includes('kuyruğu göster') || lp.includes('şarkı listesi') || lp.includes('sırada ne var')) {
            fallbackAction = { action: 'show_queue', params: {} };
        } else if (lp.match(/radyo\s*(?:aç|başlat)?\s*(powerturk|fenomen|slowturk|bestfm|lofi)?/i)) {
            const m = lp.match(/radyo\s*(?:aç|başlat)?\s*(powerturk|fenomen|slowturk|bestfm|lofi)?/i);
            fallbackAction = { action: 'play_radio', params: { station: m[1] || 'powerturk' } };
        } else if (lp.match(/(?:ses(?:i|ini)?|müzi[gğ]in?\s*sesini?)\s*(\d+)\s*(?:yap|ayarla)/i)) {
            const level = parseInt(lp.match(/(\d+)/)[1]) || 100;
            fallbackAction = { action: 'set_music_volume', params: { level } };
        } else if (lp.includes('tekrar modu') || lp.includes('şarkıyı tekrarla') || lp.includes('sarkiyi tekrarla') || lp.includes('döngü')) {
            fallbackAction = { action: 'toggle_music_loop', params: {} };
        } else if (lp.includes('kuyruğu karıştır') || lp.includes('kuyrugu karistir') || lp.includes('şarkıları karıştır') || lp.includes('sarkilari karistir')) {
            fallbackAction = { action: 'shuffle_music_queue', params: {} };
        } else if (lp.match(/(?:sohbeti|kanal\w*|buray\w*)\s*(?:özetle|ozetle|özet\s*geç|neler\s*konuşuldu|ne\s*konuşuldu)/i)) {
            fallbackAction = { action: 'summarize_chat', params: {} };
        } else if (lp.match(/(?:bizi|beni|@?\S+?)\s*(?:roastla|göm|ez|dalga\s*geç)/i)) {
            const targetMatch = userPrompt.match(/([^\s]+)\s*(?:roastla|göm|ez|dalga\s*geç)/i);
            fallbackAction = { action: 'roast_user', params: { user: targetMatch ? targetMatch[1].replace(/[@<>]/g, '') : '' } };
        } else if (lp.match(/(?:bana|@?\S+?)\s*(?:öv|iltifat\s*et|moral\s*ver|güzel\s*söz\s*söyle)/i)) {
            const targetMatch = userPrompt.match(/([^\s]+)\s*(?:öv|iltifat\s*et|moral\s*ver|güzel\s*söz\s*söyle)/i);
            fallbackAction = { action: 'praise_user', params: { user: targetMatch ? targetMatch[1].replace(/[@<>]/g, '') : '' } };
        } else if (lp.match(/(?:bilgi\s*yarışması|soru\s*sor|trivia|bize\s*soru\s*sor)/i)) {
            fallbackAction = { action: 'trivia_quiz', params: {} };
        } else if (lp.match(/(?:sunucunun|sohbetin|ortamın)\s*(?:havası|modu|ruh\s*hali|atmosferi)\s*(?:nasıl|ne)/i)) {
            fallbackAction = { action: 'server_mood', params: {} };
        } else if (lp.match(/(.+?)\s*(?:diline|ye|ya)\s*çevir\s*:\s*(.+)/i)) {
            const m = userPrompt.match(/(.+?)\s*(?:diline|ye|ya)\s*çevir\s*:\s*(.+)/i);
            fallbackAction = { action: 'translate_text', params: { target_language: m[1].trim(), text: m[2].trim() } };
        } else if (lp.match(/(?:kodu?\s*(?:incele|düzelt|hata\s*var\s*mı|analiz\s*et)|bu\s*kodda\s*hata\s*var\s*mı)/i) || userPrompt.includes('```')) {
            fallbackAction = { action: 'code_review', params: { code: userPrompt } };
        } else if (lp.match(/(koç|boğa|boga|ikizler|yengeç|yengec|aslan|başak|basak|terazi|akrep|yay|oğlak|oglak|kova|balık|balik)\s*(?:burcu?\s*(?:yorumu?|günlük)?|falı?)/i)) {
            const m = lp.match(/(koç|boğa|boga|ikizler|yengeç|yengec|aslan|başak|basak|terazi|akrep|yay|oğlak|oglak|kova|balık|balik)/i);
            fallbackAction = { action: 'daily_horoscope', params: { sign: m[1] } };
        } else if (lp.match(/(?:şiir\s*yaz|rap\s*yaz|şarkı\s*sözü\s*yaz|beste\s*yap)/i)) {
            const topic = userPrompt.replace(/.*?(?:şiir\s*yaz|rap\s*yaz|şarkı\s*sözü\s*yaz)\s*(?:hakkında|için)?\s*/i, '').trim();
            fallbackAction = { action: 'write_lyrics', params: { topic: topic || 'yazılımcı hayatı' } };
        } else if (lp.match(/(?:macera\s*(?:başlat|oyunu)|rpg\s*başlat|hikaye\s*başlat|zindana\s*gir)/i)) {
            fallbackAction = { action: 'adventure_rpg', params: { choice: 'başlangıç' } };
        } else if (lp.match(/(?:haftalık\s*bülten|sunucu\s*gazete\w*|bülteni?\s*(?:yayınla|kur|oluştur|bas)|gazete\s*(?:çıkar|yayınla|bas))/i)) {
            fallbackAction = { action: 'publish_bulletin', params: {} };
        }

        if (fallbackAction) {
            actionList = [fallbackAction];
        }
    }

    if (actionList && actionList.length > 0) {
        if (context) {
            const results = [];
            for (const item of actionList) {
                if (item && item.action) {
                    try {
                        const actionResult = await executeAction(item.action, item.params || {}, context);
                        if (actionResult) {
                            results.push(actionResult);

                            if (LOGGED_ACTIONS.has(item.action)) {
                                sendServerLog(context.guild, {
                                    title: '🤖 AI Eylemi Gerçekleştirildi',
                                    description: actionResult,
                                    color: 0xFEE75C,
                                    fields: [
                                        { name: 'Tetikleyen', value: `${context.member} (\`${context.member.user.tag}\`)`, inline: true },
                                        { name: 'Eylem', value: `\`${item.action}\``, inline: true }
                                    ]
                                }).catch(() => {});
                            }
                        }
                    } catch (actionErr) {
                        logger.error(`Eylem yürütme hatası (${item.action}):`, actionErr);
                        results.push(`❌ \`${item.action}\` eylemi yürütülürken hata oluştu: ${actionErr.message}`);
                    }
                }
            }

            if (results.length > 1) {
                finalReply = `⚡ **Toplu Eylemler Gerçekleştirildi:**\n${results.join('\n')}`;
            } else if (results.length === 1) {
                finalReply = results[0];
            } else {
                finalReply = '❌ Eylemler gerçekleştirilemedi veya yetki yetersiz.';
            }
        } else {
            finalReply = '✅ İşlemler tamamlandı.';
        }
    } else {
        // Eylem bloğu yoksa normal sohbettir: Klişe robotik kalıpları temizle
        finalReply = finalReply
            .replace(/^İsteğinizi aldım[,\.\s]*hemen hallediyorum[!.]*/gi, '')
            .replace(/^İsteğinizi aldım[!.]*/gi, '')
            .replace(/^Hemen hallediyorum[!.]*/gi, '')
            .replace(/google\s+gemini\s+altyapısıyla\s+çalışan\s+mimar\s+benim/gi, 'Bu sunucunun mimarı ve yöneticisi benim.')
            .replace(/google\s+gemini(?:\s+altyapısıyla)?/gi, 'bu sunucunun mimarı')
            .replace(/gemini\s+altyapısıyla/gi, 'sunucu mimarı olarak')
            .trim();

        if (!finalReply) {
            finalReply = 'Nasıl yardımcı olabilirim?';
        }
    }

    history.push({ role: 'assistant', content: finalReply, timestamp: Date.now() });
    conversationHistory.set(contextId, history);

    return finalReply;
}

function splitMessage(text, maxLength = 1900) {
    if (text.length <= maxLength) return [text];

    const chunks = [];
    let current = '';

    const lines = text.split('\n');
    for (const line of lines) {
        if ((current + '\n' + line).length > maxLength) {
            chunks.push(current);
            current = line;
        } else {
            current = current ? current + '\n' + line : line;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

module.exports = {
    askOpenClaw,
    splitMessage,
    generateJSON,
    checkAiCooldown,
    callAIProviders
};
