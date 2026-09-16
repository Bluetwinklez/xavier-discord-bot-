const { PassThrough, Readable } = require('stream');
const { createAudioResource, StreamType, EndBehaviorType } = require('@discordjs/voice');
const prism = require('prism-media');
const logger = require('./logger');

const GEMINI_LIVE_HOST = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';

class GeminiLiveSession {
    constructor({ guild, voiceChannel, member, persona, apiKey, voiceName = 'Aoede' }) {
        this.guild = guild;
        this.voiceChannel = voiceChannel;
        this.member = member;
        this.persona = persona;
        this.apiKey = apiKey || process.env.GEMINI_API_KEY;
        this.voiceName = voiceName || process.env.GEMINI_LIVE_VOICE || 'Aoede';

        this.ws = null;
        this.isConnected = false;
        this.isSetupComplete = false;
        this.destroyed = false;

        this.audioOutStream = null;
        this.audioResource = null;
        this.player = null;
        this.opusReceiver = null;
    }

    async start(connection, player) {
        if (!this.apiKey) {
            throw new Error('GEMINI_API_KEY bulunamadı.');
        }

        this.player = player;
        const url = `${GEMINI_LIVE_HOST}?key=${this.apiKey}`;
        const WebSocketClass = globalThis.WebSocket || require('ws');
        this.ws = new WebSocketClass(url);

        this.audioOutStream = new PassThrough();
        this.audioResource = createAudioResource(this.audioOutStream, {
            inputType: StreamType.Raw,
            inlineVolume: true
        });
        if (this.audioResource.volume) {
            this.audioResource.volume.setVolume(1.0);
        }
        this.player.play(this.audioResource);

        this.ws.addEventListener('open', () => {
            this.isConnected = true;
            logger.info(`[Gemini Live] WebSocket bağlandı (${this.guild.name})`);
            this.sendSetup();
        });

        this.ws.addEventListener('message', async (event) => {
            try {
                const text = typeof event.data.text === 'function' ? await event.data.text() : event.data.toString();
                const msg = JSON.parse(text);

                if (msg.setupComplete) {
                    this.isSetupComplete = true;
                    logger.info(`[Gemini Live] Oturum hazır (Ses: ${this.voiceName})`);
                    this.startDiscordAudioCapture(connection);
                    return;
                }

                if (msg.serverContent) {
                    const { modelTurn, interrupted, turnComplete } = msg.serverContent;

                    if (interrupted) {
                        logger.info('[Gemini Live] 🛑 Kullanıcı araya girdi (Barge-In)! Ses kesildi.');
                        this.flushAudio();
                    }

                    if (modelTurn?.parts) {
                        for (const part of modelTurn.parts) {
                            if (part.inlineData?.data) {
                                const pcm24kMono = Buffer.from(part.inlineData.data, 'base64');
                                const pcm48kStereo = this.resample24kMonoTo48kStereo(pcm24kMono);
                                if (!this.destroyed && this.audioOutStream) {
                                    this.audioOutStream.write(pcm48kStereo);
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                logger.error('[Gemini Live] Yanıt işleme hatası:', err.message);
            }
        });

        this.ws.addEventListener('error', (err) => {
            logger.error('[Gemini Live] WebSocket Hatası:', err.message || err);
        });

        this.ws.addEventListener('close', (event) => {
            this.isConnected = false;
            logger.info(`[Gemini Live] Bağlantı kapandı: code=${event.code}`);
        });
    }

    sendSetup() {
        const isFlirt = this.persona?.id === 'flirt';
        const systemPrompt = `Sen ${this.member.displayName} ile Discord ses kanalında canlı konuşan bir yapay zekasın.
Kişiliğin: ${isFlirt ? 'Aşırı tatlı dilli, flörtöz, cilveli, sevecen, samimi ve esprili' : 'Samimi, yardımsever, neşeli ve arkadaş canlısı'}.
KURALLAR:
1. Türkçe konuş.
2. Doğal konuşma diliyle, kısa ve akıcı (en fazla 1-2 cümle) yanıtlar ver.
3. Asla liste yapma veya markdown kullanma.
4. Şarkı istendiğinde neşeyle mırıldan veya cevap ver.`;

        const setupPayload = {
            setup: {
                model: 'models/gemini-2.5-flash-native-audio-latest',
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: this.voiceName
                            }
                        }
                    }
                },
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                }
            }
        };

        this.ws.send(JSON.stringify(setupPayload));
    }

    startDiscordAudioCapture(connection) {
        if (!connection || this.destroyed) return;

        try {
            this.opusReceiver = connection.receiver.subscribe(this.member.id, {
                end: { behavior: EndBehaviorType.Manual }
            });

            const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
            this.opusReceiver.pipe(decoder);

            decoder.on('data', (pcm48kStereo) => {
                if (this.destroyed || !this.isConnected || !this.isSetupComplete) return;

                const pcm16kMono = this.downsample48kStereoTo16kMono(pcm48kStereo);
                if (pcm16kMono.length === 0) return;

                const audioChunkMsg = {
                    realtimeInput: {
                        mediaChunks: [
                            {
                                mimeType: 'audio/pcm;rate=16000',
                                data: pcm16kMono.toString('base64')
                            }
                        ]
                    }
                };

                try {
                    this.ws.send(JSON.stringify(audioChunkMsg));
                } catch {}
            });

            decoder.on('error', () => {});
        } catch (err) {
            logger.error('[Gemini Live] Ses yakalama başlatılamadı:', err.message);
        }
    }

    downsample48kStereoTo16kMono(stereo48k) {
        const samples = stereo48k.length / 4;
        const targetSamples = Math.floor(samples / 3);
        const mono16Buffer = Buffer.allocUnsafe(targetSamples * 2);

        let srcIdx = 0;
        let dstIdx = 0;
        for (let i = 0; i < targetSamples; i++) {
            const left = stereo48k.readInt16LE(srcIdx);
            const right = stereo48k.readInt16LE(srcIdx + 2);
            const mono = (left + right) >> 1;
            mono16Buffer.writeInt16LE(mono, dstIdx);
            srcIdx += 12;
            dstIdx += 2;
        }
        return mono16Buffer;
    }

    resample24kMonoTo48kStereo(mono24k) {
        const numSamples = mono24k.length / 2;
        const stereo48k = Buffer.allocUnsafe(numSamples * 8);

        let srcIdx = 0;
        let dstIdx = 0;
        for (let i = 0; i < numSamples; i++) {
            const sample = mono24k.readInt16LE(srcIdx);
            // 24kHz -> 48kHz (2x örnek tekrarı) + Stereo (Sol + Sağ)
            stereo48k.writeInt16LE(sample, dstIdx);
            stereo48k.writeInt16LE(sample, dstIdx + 2);
            stereo48k.writeInt16LE(sample, dstIdx + 4);
            stereo48k.writeInt16LE(sample, dstIdx + 6);
            srcIdx += 2;
            dstIdx += 8;
        }
        return stereo48k;
    }

    flushAudio() {
        if (this.audioOutStream) {
            // Bufferı temizlemek için yeni stream oluştur
            try {
                this.audioOutStream.destroy();
            } catch {}
            this.audioOutStream = new PassThrough();
            this.audioResource = createAudioResource(this.audioOutStream, {
                inputType: StreamType.Raw,
                inlineVolume: true
            });
            if (this.audioResource.volume) {
                this.audioResource.volume.setVolume(1.0);
            }
            this.player.play(this.audioResource);
        }
    }

    destroy() {
        this.destroyed = true;
        this.isConnected = false;
        this.isSetupComplete = false;

        try {
            this.opusReceiver?.destroy();
        } catch {}

        try {
            this.ws?.close();
        } catch {}

        try {
            this.audioOutStream?.destroy();
        } catch {}
    }
}

module.exports = {
    GeminiLiveSession
};
