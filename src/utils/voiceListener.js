const { EndBehaviorType, VoiceConnectionStatus } = require('@discordjs/voice');
const prism = require('prism-media');
const { playTTS } = require('./radioCatalog');
const logger = require('./logger');

function getAskOpenClaw() {
    return require('./aiManager').askOpenClaw;
}

const activeListeners = new Map();
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 5;

// Whisper halüsinasyon filtresi
const WHISPER_HALLUCINATIONS = [
    /alt\s*yaz[ıi]/i,
    /abone\s*ol/i,
    /izledi[gğ]iniz\s*i[cç]in/i,
    /be[gğ]enmeyi\s*unutma/i,
    /ho[sş]\s*veya\s*ho[sş]\s*kal/i,
    /m\.?k\.?/i,
    /amara\.org/i,
    /subtitle/i,
    /transkript/i
];

function sessionKey(guildId, userId) {
    return `${guildId}:${userId}`;
}

function calculateRms(pcmBuffer) {
    let sumSquares = 0;
    const sampleCount = pcmBuffer.length / 2;
    for (let i = 0; i < pcmBuffer.length; i += 2) {
        const sample = pcmBuffer.readInt16LE(i);
        sumSquares += sample * sample;
    }
    return Math.sqrt(sumSquares / sampleCount);
}

// 48000Hz Stereo PCM'i Whisper'ın native formatı olan 16000Hz Mono PCM'e dönüştürür (3:1 anti-aliasing)
function downsampleStereo48toMono16(stereoBuffer) {
    const outLength = Math.floor(stereoBuffer.length / 12) * 2;
    const mono16Buffer = Buffer.alloc(outLength);

    let outIdx = 0;
    for (let i = 0; i + 12 <= stereoBuffer.length; i += 12) {
        const left1 = stereoBuffer.readInt16LE(i);
        const right1 = stereoBuffer.readInt16LE(i + 2);
        const left2 = stereoBuffer.readInt16LE(i + 4);
        const right2 = stereoBuffer.readInt16LE(i + 6);
        const left3 = stereoBuffer.readInt16LE(i + 8);
        const right3 = stereoBuffer.readInt16LE(i + 10);

        const avg = Math.round((left1 + right1 + left2 + right2 + left3 + right3) / 6);
        mono16Buffer.writeInt16LE(avg, outIdx);
        outIdx += 2;
    }

    return mono16Buffer;
}

function pcmToWav(pcmBuffer, sampleRate = 16000, channels = 1, bitDepth = 16) {
    const byteRate = sampleRate * channels * (bitDepth / 8);
    const blockAlign = channels * (bitDepth / 8);
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcmBuffer.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitDepth, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcmBuffer.length, 40);
    return Buffer.concat([header, pcmBuffer]);
}

async function transcribeAudio(wavBuffer) {
    // 1. Öncelikli Ultra Hızlı Motor: Groq Whisper Large v3 Turbo (150ms Gecikme)
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
        try {
            const form = new FormData();
            form.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'audio.wav');
            form.append('model', 'whisper-large-v3-turbo');
            form.append('language', 'tr');
            form.append('temperature', '0');

            const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${groqKey}` },
                body: form
            });

            if (res.ok) {
                const data = await res.json();
                if (data.text && data.text.trim().length > 0) {
                    return data.text.trim();
                }
            }
        } catch (err) {
            logger.error('[STT] Groq Whisper hatası:', err.message);
        }
    }

    // 2. Yedek: Google Gemini 2.5 Flash
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                inlineData: {
                                    mimeType: 'audio/wav',
                                    data: wavBuffer.toString('base64')
                                }
                            },
                            {
                                text: 'Bu ses kaydında konuşulan Türkçe cümleyi yaz. Sadece duyulan metni döndür.'
                            }
                        ]
                    }]
                })
            });

            if (res.ok) {
                const data = await res.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text && text.trim().length > 0) {
                    return text.trim();
                }
            }
        } catch (err) {
            logger.error('[STT] Gemini ses algılama hatası:', err.message);
        }
    }

    return null;
}

// Sessizlik kesme süresi: eskiden 150ms idi — doğal cümle arası nefes/duraklamalar bile bundan
// uzun sürebildiği için cümleler ortadan kesilip Whisper'a yarım gidiyordu. 600ms hem doğal
// duraklamaları tolere ediyor hem de tepki süresini gereksiz uzatmıyor.
const SILENCE_CUTOFF_MS = 600;
// Araya girme (barge-in) için erken tetikleme eşiği: tam RMS eşiğinden (100) daha düşük tutulur,
// amaç STT'nin bitmesini beklemeden "biri konuşmaya başladı" sinyalini anında yakalamak.
const BARGE_IN_RMS_THRESHOLD = 60;

function listenForUtterance(connection, userId, onResult, onSpeechStart) {
    let opusStream;
    try {
        opusStream = connection.receiver.subscribe(userId, {
            end: { behavior: EndBehaviorType.AfterSilence, duration: SILENCE_CUTOFF_MS }
        });
    } catch (err) {
        logger.error('Ses aboneliği başlatılamadı:', err.message);
        onResult(null, true);
        return;
    }

    const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
    const chunks = [];
    let speechStartFired = false;

    opusStream.pipe(decoder);
    decoder.on('data', chunk => {
        chunks.push(chunk);
        // Tam STT sonucu birkaç yüz ms - birkaç saniye sonra gelir; bot konuşurken kullanıcı
        // mikrofona konuşmaya başlar başlamaz (STT'yi beklemeden) haber ver ki barge-in anlık olsun.
        if (!speechStartFired && onSpeechStart) {
            speechStartFired = calculateRms(chunk) > BARGE_IN_RMS_THRESHOLD;
            if (speechStartFired) onSpeechStart();
        }
    });
    decoder.on('error', () => {});
    decoder.on('end', async () => {
        const stereoPcm = Buffer.concat(chunks);

        // 1. Süre kontrolü (en az 0.20 saniye olmalı)
        if (stereoPcm.length < 48000 * 2 * 2 * 0.20) {
            onResult(null, false);
            return;
        }

        // 2. Ses seviyesi (RMS) kontrolü - hassas eşik (100)
        const rms = calculateRms(stereoPcm);
        if (rms < 100) {
            onResult(null, false);
            return;
        }

        // 3. Stereo 48kHz -> Mono 16kHz WAV dönüşümü
        const mono16Pcm = downsampleStereo48toMono16(stereoPcm);
        const wav = pcmToWav(mono16Pcm, 16000, 1, 16);

        const text = await transcribeAudio(wav);
        if (text === null) {
            onResult(null, true);
        } else {
            const clean = text.trim();
            const isHallucination = WHISPER_HALLUCINATIONS.some(rx => rx.test(clean));
            if (isHallucination || clean.length < 2) {
                onResult(null, false);
            } else {
                onResult(clean, false);
            }
        }
    });
}

function cleanForVoiceSpeech(text) {
    if (!text) return '';
    let cleaned = text;
    // ```action ... ``` bloğunu seslendirmeden temizle
    cleaned = cleaned.replace(/```action[\s\S]*?```/gi, '');
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
    cleaned = cleaned.replace(/https?:\/\/\S+/g, '');
    cleaned = cleaned.replace(/<@!?\d+>/g, '');
    cleaned = cleaned.replace(/<#\d+>/g, '');
    cleaned = cleaned.replace(/<@&\d+>/g, '');
    cleaned = cleaned.replace(/<a?:\w+:\d+>/g, '');
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
    cleaned = cleaned.replace(/[#*_~>|]/g, '');
    cleaned = cleaned.replace(/^[-•*]\s+/gm, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

async function startListening(voiceChannel, textChannel, member, guild, client) {
    if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
        return '❌ Sesle komut özelliği için `GROQ_API_KEY` veya `GEMINI_API_KEY` ayarlanmamış. `.env` dosyasına en az birini ekleyip botu yeniden başlatın.';
    }

    const { getVoiceSession, connectToVoice } = require('./radioCatalog');
    let session = getVoiceSession(guild.id);
    if (!session || !session.connection || session.connection.state?.status === VoiceConnectionStatus.Destroyed || session.selfDeaf !== false) {
        try {
            session = await connectToVoice(voiceChannel, false, { selfDeaf: false });
        } catch (err) {
            logger.error('Ses kanalına bağlanılamadı:', err);
            return `❌ Ses kanalına bağlanırken hata oluştu: ${err.message}`;
        }
    }

    if (!session || !session.connection) {
        return '❌ Bot ses kanalına bağlanamadı. Lütfen botun ses kanalına bağlanma ve konuşma izinlerini kontrol edin.';
    }

    const key = sessionKey(guild.id, member.id);
    const existing = activeListeners.get(key);
    if (existing?.active) {
        return `⚠️ Zaten sesli komut dinleme aktif. Durdurmak için \`/sesle-dinle-durdur\` yazabilirsin.`;
    }

    activeListeners.set(key, {
        active: true,
        voiceChannelId: voiceChannel.id,
        textChannel,
        guild,
        member,
        client,
        lastActivityAt: Date.now(),
        failCount: 0,
        isSpeaking: false
    });

    // Odaya girer girmez sesli olarak selam ver
    const { getPersona } = require('./aiPersonas');
    const { getSettings } = require('./database');
    const gSettings = getSettings(guild.id);
    const persona = getPersona(gSettings.aiPersona || 'gemini');
    const joinGreeting = persona.id === 'flirt' ? 'Geldim tatlım, seni dinliyorum!' : 'Ses kanalına katıldım, seni dinliyorum.';
    const { playTTS } = require('./radioCatalog');
    playTTS(voiceChannel, joinGreeting).catch(() => {});

    const loop = () => {
        const current = activeListeners.get(key);
        if (!current || !current.active) return;

        listenForUtterance(session.connection, member.id, (text, failed) => {
            const stateNow = activeListeners.get(key);
            if (!stateNow || !stateNow.active) return;

            // Bot konuşurken kullanıcı araya girerse (Barge-In): Botun sesini anında kes.
            // Asıl kesme artık onSpeechStart ile STT bitmeden gerçekleşiyor; bu blok, erken RMS
            // eşiğini kaçıran (çok kısa/alçak sesli) durumlar için ikinci bir güvenlik ağı.
            if (stateNow.isSpeaking) {
                if (text && text.trim().length > 0) {
                    logger.info(`[Ses Dinleme] 🛑 Araya Girme (Barge-In): Bot susturuldu, kullanıcı dinleniyor.`);
                    try {
                        session.player?.stop(true);
                    } catch {}
                    stateNow.isSpeaking = false;
                } else {
                    loop();
                    return;
                }
            }

            if (failed) {
                stateNow.failCount++;
                if (stateNow.failCount >= MAX_CONSECUTIVE_FAILURES) {
                    activeListeners.delete(key);
                    textChannel.send(
                        `⚠️ ${member} sesle komut dinleme bağlantı hatası nedeniyle durduruldu.`
                    ).catch(() => {});
                    return;
                }
                setTimeout(loop, 500);
                return;
            }

            if (!text) {
                loop();
                return;
            }

            stateNow.failCount = 0;
            stateNow.lastActivityAt = Date.now();

            (async () => {
                try {
                    console.log(`🎤 [Ses Dinleme] ${member.displayName}: "${text}"`);

                    const rawClean = text.trim().toLowerCase();
                    let cleanText = rawClean.replace(/^(?:master|xavier|bot)[,\s.:;!?-]+/i, '').trim();
                    if (!cleanText) {
                        cleanText = 'burada mısın';
                    }

                    const { getSettings } = require('./database');
                    const { getPersona } = require('./aiPersonas');
                    const guildSettings = getSettings(guild.id);
                    const persona = getPersona(guildSettings.aiPersona || 'gemini');

                    // 1. HIZLI SESLİ EYLEM: Sesten Ayrılma
                    if (cleanText.match(/^(sesten\s*(ayrıl|çık|git|ayril|cik)|kanaldan\s*(ayrıl|çık|ayril|cik)|odadan\s*(ayrıl|çık|ayril|cik)|sesli\s*(sohbetten|odadan)?\s*(ayrıl|çık|ayril|cik)|dinlemeyi\s*(bırak|kapat|durdur)|görüşürüz|baybay|kendine\s*iyi\s*bak)$/i)) {
                        stateNow.isSpeaking = true;
                        let farewell = 'Görüşmek üzere, ses kanalından ayrılıyorum.';
                        if (persona.id === 'flirt') farewell = 'Gidiyor musun hemen tatlım? Çok özletme kendini, görüşürüz!';
                        else if (persona.id === 'doom') farewell = 'Huzurumdan ayrılmana izin veriyorum fani!';

                        await playTTS(voiceChannel, farewell);
                        setTimeout(() => {
                            stopListening(guild.id, member.id);
                            const { cleanupVoice } = require('./radioCatalog');
                            cleanupVoice(guild.id);
                            try {
                                guild.members.me?.voice?.disconnect();
                            } catch {}
                        }, 3000);
                        return;
                    }

                    // 2. HIZLI SESLİ EYLEM: Sunucu Üye Sayısı
                    if (cleanText.match(/(sunucuda\s*kaç\s*(kişi|üye)\s*var|üye\s*sayısı\s*kaç|kaç\s*kişiyiz|sunucu\s*mevcudu)/i)) {
                        stateNow.isSpeaking = true;
                        let reply = `Sunucumuzda şu anda toplam ${guild.memberCount} üye bulunuyor.`;
                        if (persona.id === 'flirt') reply = `Sunucumuzda seninle beraber ${guild.memberCount} harika insan var tatlım.`;
                        else if (persona.id === 'doom') reply = `Hükmettiğim bu diyarda tam ${guild.memberCount} fani mevcut.`;

                        console.log(`🤖 [Ses Yanıtı]: "${reply}"`);
                        await playTTS(voiceChannel, reply);
                        stateNow.isSpeaking = false;
                        loop();
                        return;
                    }

                    // 3. HIZLI SESLİ EYLEM: Yazı Tura
                    if (cleanText.match(/^(yazı\s*tura(\s*at)?)$/i)) {
                        stateNow.isSpeaking = true;
                        const coin = Math.random() < 0.5 ? 'yazı' : 'tura';
                        let res = `${coin.toUpperCase()} geldi!`;
                        if (persona.id === 'flirt') res = `Senin şansına yazı tura attım ve ${coin} geldi tatlım!`;

                        console.log(`🤖 [Ses Yanıtı]: "${res}"`);
                        await playTTS(voiceChannel, res);
                        stateNow.isSpeaking = false;
                        loop();
                        return;
                    }

                    // 4. HIZLI SESLİ EYLEM: Zar At
                    if (cleanText.match(/^(zar\s*at)$/i)) {
                        stateNow.isSpeaking = true;
                        const zar = Math.floor(Math.random() * 6) + 1;
                        let res = `Zar attım, ${zar} geldi!`;
                        if (persona.id === 'flirt') res = `Senin güzel hatırına zar attım, ${zar} geldi canım!`;

                        console.log(`🤖 [Ses Yanıtı]: "${res}"`);
                        await playTTS(voiceChannel, res);
                        stateNow.isSpeaking = false;
                        loop();
                        return;
                    }

                    // 5. HIZLI SESLİ EYLEM: Müzik Çalma / Durdurma
                    if (cleanText.match(/^(?:müziği\s*durdur|şarkıyı\s*durdur|müziği\s*kapat|şarkıyı\s*kapat|müziği\s*kes|müziği\s*sustur)$/i)) {
                        stateNow.isSpeaking = true;
                        const { stopMusic } = require('./musicManager');
                        stopMusic(guild.id);
                        const stopMsg = persona.id === 'flirt' ? 'Müziği senin için durdurdum tatlım.' : 'Müzik durduruldu.';
                        await playTTS(voiceChannel, stopMsg);
                        stateNow.isSpeaking = false;
                        loop();
                        return;
                    }

                    const musicPlayMatch = cleanText.match(/^(?:müzik|şarkı|parça)$|(?:müzik\s*(?:çal|aç|baslat|başlat)|şarkı\s*(?:çal|aç|söyle|oynat|patlat)|(?:bana\s*)?(?:bir\s*)?şarkı\s*aç|parça\s*(?:aç|çal))\s*[:\s]*(.*)/i);
                    if (musicPlayMatch) {
                        stateNow.isSpeaking = true;
                        let songQuery = (musicPlayMatch[1] || '').trim();
                        if (!songQuery || songQuery.length < 2) {
                            songQuery = 'Nefes\'in kızı';
                        }
                        const sayMsg = persona.id === 'flirt'
                            ? `Senin için ${songQuery} şarkısını hemen açıyorum tatlım!`
                            : `${songQuery} şarkısını başlatıyorum.`;
                        await playTTS(voiceChannel, sayMsg);
                        const { playQuery } = require('./musicManager');
                        playQuery(guild, voiceChannel, textChannel, songQuery, member.user?.tag || member.displayName).catch(err => {
                            logger.error('Sesli müzik çalma hatası:', err);
                        });
                        stateNow.isSpeaking = false;
                        loop();
                        return;
                    }

                    // 6. GENEL AI DÜŞÜNME MOTORU VE EYLEM HATTI
                    stateNow.isSpeaking = true;
                    const contextId = `voice-${guild.id}-${member.id}`;
                    const context = { guild, channel: textChannel, member, client };
                    const answer = await getAskOpenClaw()(contextId, cleanText || text, member.displayName, context);

                    let spokenText = cleanForVoiceSpeech(answer);
                    if (!spokenText || spokenText.length < 2) {
                        spokenText = persona.id === 'flirt' ? 'Seni dinliyorum canım!' : 'Seni dinliyorum!';
                    }
                    console.log(`🤖 [Ses Yanıtı]: "${spokenText}"`);

                    await playTTS(voiceChannel, spokenText);
                    stateNow.isSpeaking = false;
                } catch (err) {
                    logger.error('Sesle komut işleme hatası:', err);
                    if (stateNow) stateNow.isSpeaking = false;
                }
                loop();
            })();
        }, () => {
            // Erken tetikleyici: kullanıcı konuşmaya başlar başlamaz (STT bitmeden) bot sesini kes
            const stateNow = activeListeners.get(key);
            if (stateNow?.isSpeaking) {
                logger.info('[Ses Dinleme] 🛑 Anlık Araya Girme (erken RMS tetikleyici).');
                try {
                    session.player?.stop(true);
                } catch {}
                stateNow.isSpeaking = false;
            }
        });
    };
    loop();

    return `🎙️ **${member.displayName}** için sesle komut dinleme başlatıldı! Konuştuğunda seni dinleyip doğrudan sesli yanıt vereceğim.\n*Durdurmak için \`/sesle-dinle-durdur\` yazabilirsin.*`;
}

function stopListening(guildId, userId) {
    const key = sessionKey(guildId, userId);
    const state = activeListeners.get(key);
    if (!state?.active) return false;
    activeListeners.delete(key);
    return true;
}

function handleMemberLeftVoiceChannel(guildId, userId, leftChannelId) {
    const key = sessionKey(guildId, userId);
    const state = activeListeners.get(key);
    if (!state?.active || state.voiceChannelId !== leftChannelId) return;
    activeListeners.delete(key);
}

setInterval(() => {
    const now = Date.now();
    for (const [key, state] of activeListeners) {
        if (state.active) {
            if (now - state.lastActivityAt > INACTIVITY_TIMEOUT_MS) {
                activeListeners.delete(key);
            }
        }
    }
}, 60 * 1000);

module.exports = {
    startListening,
    stopListening,
    handleMemberLeftVoiceChannel
};
