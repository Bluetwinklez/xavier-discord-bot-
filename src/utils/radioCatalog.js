const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    getVoiceConnection,
    StreamType
} = require('@discordjs/voice');
const { Readable } = require('stream');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const logger = require('./logger');

// Fish Audio ile seslendirme dener; yanıt gövdesini TAMAMEN indirmeden (arrayBuffer beklemeden)
// doğrudan Node Readable stream olarak döndürür — ilk ses paketi gelir gelmez çalma başlayabilir.
// Önceki sürüm `await res.arrayBuffer()` ile tüm dosyayı bekliyordu; uzun cevaplarda bu tek başına
// saniyeler süren sessiz bekleme yaratıyordu.
async function fetchFishAudioTTS(text) {
    const apiKey = process.env.FISHAUDIO_API_KEY;
    if (!apiKey) return null;

    try {
        const res = await fetch('https://api.fish.audio/v1/tts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text.slice(0, 300),
                format: 'mp3',
                latency: 'balanced',
                reference_id: process.env.FISHAUDIO_VOICE_ID || 'a86c959f26294c6da6a171c3d91f8c4a'
            })
        });

        if (!res.ok || !res.body) {
            console.warn('Fish Audio TTS isteği başarısız:', res.status);
            return null;
        }

        return Readable.fromWeb(res.body);
    } catch (err) {
        console.warn('Fish Audio TTS hatası:', err.message);
        return null;
    }
}

// Microsoft Edge'in "Sesli Oku" motorunu kullanır — API anahtarı GEREKMEZ, kaliteli Türkçe nöral ses
// üretir. Fish Audio anahtarı yoksa (veya isteği başarısız olursa) Google Translate'in resmi olmayan,
// 200 karakterle sınırlı ve kırılgan uç noktasına düşmeden önce bu devreye giriyor.
async function fetchEdgeTTS(text) {
    try {
        const tts = new MsEdgeTTS();
        await tts.setMetadata(process.env.EDGE_TTS_VOICE || 'tr-TR-AhmetNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const { audioStream } = tts.toStream(text.slice(0, 500));
        return audioStream;
    } catch (err) {
        console.warn('Edge TTS hatası:', err.message);
        return null;
    }
}

const RADIO_STATIONS = {
    powerturk: {
        id: 'powerturk',
        name: '📻 PowerTürk',
        description: 'En Popüler Türkçe Pop ve Hit Parçalar',
        url: 'http://listen.powerapp.com.tr/powerturk/mpeg/icecast.audio'
    },
    fenomen: {
        id: 'fenomen',
        name: '📻 Radyo Fenomen',
        description: 'Dünya Genelinden En İyi Hit Yabancı Şarkılar',
        url: 'http://listen.powerapp.com.tr/fenomen/mpeg/icecast.audio'
    },
    slowturk: {
        id: 'slowturk',
        name: '📻 SlowTürk',
        description: 'Aşkın ve Romantizmin En İyi Slow Şarkıları',
        url: 'https://radyo.duhnet.tv/slowturk'
    },
    bestfm: {
        id: 'bestfm',
        name: '📻 Best FM',
        description: 'Türkiye\'nin En Çok Dinlenen Konuşan Radyosu',
        url: 'http://46.20.7.126:80/'
    },
    lofi: {
        id: 'lofi',
        name: '☕ 7/24 Lofi & Chill Beats',
        description: 'Ders Çalışma, Kodlama ve Rahatlama Odaklı Müzik',
        url: 'https://streams.ilovemusic.de/iloveradio17.mp3'
    }
};

const activeVoiceSessions = new Map(); // guildId -> { connection, player, stay247, channelId, type }

function getRadioStations() {
    return RADIO_STATIONS;
}

// selfDeaf: SADECE sesle-komut dinlemenin ZORUNLU kıldığı `false` değeri açıkça istenir — Discord,
// kendini sağır (self-deaf) işaretlemiş bir bota gelen ses paketlerini iletmez; bu ayar yanlış olduğunda
// receiver tamamen sessizlik/gürültü alır ve ASR bunu rastgele bir dile "halüsinasyon" yapar.
// Radyo/TTS/247 gibi sadece SES ÇALAN kullanımlar `selfDeaf` parametresini HİÇ vermez (undefined) —
// böylece aktif bir dinleme oturumu varsa onu bozmadan (sağır durumunu değiştirmeden) aynı bağlantıyı
// paylaşırlar; yeni bir bağlantı kuruluyorsa varsayılan olarak sağır (bant genişliği tasarrufu) açılır.
async function connectToVoice(voiceChannel, isStay247 = false, { selfDeaf } = {}) {
    const guild = voiceChannel.guild;
    const existing = activeVoiceSessions.get(guild.id);

    if (existing && existing.connection && existing.connection.state.status !== VoiceConnectionStatus.Destroyed) {
        const deafMismatch = selfDeaf !== undefined && existing.selfDeaf !== selfDeaf;
        if (existing.channelId !== voiceChannel.id || deafMismatch) {
            // Kanal değişmiş VEYA sağır durumu AÇIKÇA farklı isteniyorsa (Discord bunu canlıyken
            // değiştirmeye izin vermez) yeniden bağlanılır. Aksi halde mevcut bağlantı korunur.
            existing.connection.destroy();
        } else {
            return existing;
        }
    }

    const resolvedSelfDeaf = selfDeaf !== undefined ? selfDeaf : true;
    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: resolvedSelfDeaf,
        selfMute: false
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    // Sessiz başarısızlıkları görünür kılmak için: dinleyicisiz bir 'error' event'i Node'da
    // uncaught exception olarak patlayabilir, ayrıca player durum geçişlerini teşhis için loglar.
    player.on('error', (err) => {
        logger.error(`AudioPlayer hatası (kanal: ${voiceChannel.name}):`, err);
    });
    player.on('stateChange', (oldState, newState) => {
        logger.info(`[Ses] Player durumu: ${oldState.status} -> ${newState.status} (kanal: ${voiceChannel.name})`);
    });
    connection.on('error', (err) => {
        logger.error(`VoiceConnection hatası (kanal: ${voiceChannel.name}):`, err);
    });

    const session = {
        connection,
        player,
        stay247: isStay247,
        channelId: voiceChannel.id,
        selfDeaf: resolvedSelfDeaf,
        type: 'idle'
    };

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        if (session.stay247) {
            // Otomatik yeniden bağlanma
            setTimeout(() => {
                const targetChannel = guild.channels.cache.get(session.channelId);
                if (targetChannel) {
                    connectToVoice(targetChannel, true).catch(() => {});
                }
            }, 3000);
        } else {
            cleanupVoice(guild.id);
        }
    });

    player.on('error', err => {
        console.warn(`Ses çalar hatası (${guild.name}):`, err.message);
    });

    activeVoiceSessions.set(guild.id, session);
    return session;
}

async function playRadio(voiceChannel, stationKey) {
    const station = RADIO_STATIONS[stationKey.toLowerCase()] || RADIO_STATIONS.powerturk;
    const session = await connectToVoice(voiceChannel, false);

    const resource = createAudioResource(station.url, { inlineVolume: true });
    if (resource.volume) resource.volume.setVolume(0.85);

    session.player.play(resource);
    session.type = 'radio';
    session.stationName = station.name;

    return station;
}

async function playTTS(voiceChannel, text) {
    const session = await connectToVoice(voiceChannel, false);

    // 3 katmanlı TTS: Fish Audio (anahtarlıysa, en iyi kalite/klonlama) -> Edge TTS (anahtarsız,
    // kaliteli nöral ses) -> Google Translate (son çare, resmi olmayan ve kırılgan).
    const fishAudioStream = await fetchFishAudioTTS(text);
    const edgeStream = fishAudioStream ? null : await fetchEdgeTTS(text);

    let resource;
    if (fishAudioStream) {
        resource = createAudioResource(fishAudioStream, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true
        });
        logger.info('[TTS] Fish Audio akışı (stream) çalınıyor.');
    } else if (edgeStream) {
        resource = createAudioResource(edgeStream, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true
        });
        logger.info('[TTS] Edge TTS akışı çalınıyor.');
    } else {
        // Fish Audio ve Edge TTS ikisi de kullanılamadıysa eski (resmi olmayan) yönteme düş
        logger.warn('[TTS] Fish Audio ve Edge TTS kullanılamadı, Google Translate TTS yedeğine düşülüyor.');
        const cleanText = encodeURIComponent(text.slice(0, 200));
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${cleanText}&tl=tr&client=tw-ob`;
        resource = createAudioResource(ttsUrl, { inlineVolume: true });
    }

    if (resource.volume) resource.volume.setVolume(1.0);

    session.player.play(resource);
    logger.info(`[TTS] player.play() çağrıldı, mevcut player durumu: ${session.player.state.status}`);
    session.type = 'tts';

    return true;
}

async function set247Voice(voiceChannel) {
    const session = await connectToVoice(voiceChannel, true);
    session.stay247 = true;
    return true;
}

function cleanupVoice(guildId) {
    const session = activeVoiceSessions.get(guildId);
    if (session) {
        session.stay247 = false;
        try {
            session.player?.stop(true);
        } catch {}
        try {
            if (session.connection?.state?.status !== VoiceConnectionStatus.Destroyed) {
                session.connection?.destroy();
            }
        } catch {}
        activeVoiceSessions.delete(guildId);
    }

    try {
        const conn = getVoiceConnection(guildId);
        if (conn && conn.state?.status !== VoiceConnectionStatus.Destroyed) {
            conn.destroy();
        }
    } catch {}
}

function getVoiceSession(guildId) {
    return activeVoiceSessions.get(guildId);
}

module.exports = {
    RADIO_STATIONS,
    getRadioStations,
    connectToVoice,
    playRadio,
    playTTS,
    set247Voice,
    cleanupVoice,
    getVoiceSession,
    getSession: getVoiceSession
};
