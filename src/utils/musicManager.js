const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const {
    createAudioPlayer,
    createAudioResource,
    joinVoiceChannel,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    StreamType
} = require('@discordjs/voice');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { getMusicClient } = require('./musicClient');

const MAX_QUEUE_SIZE = 100;

// Ses efekti filtreleri: yt-dlp'nin ham ses akışı bu ffmpeg filtrelerinden geçirilir. 'none'
// filtresiz orijinal akışı kullanır (gereksiz ffmpeg süreci açmamak için).
const EFFECT_FILTERS = {
    bassboost: 'bass=g=18',
    nightcore: 'asetrate=48000*1.25,aresample=48000,atempo=1.06'
};

// Windows'ta projeye gömülü yt-dlp.exe kullanılır; başka platformda veya .exe eksikse
// sistem PATH'indeki 'yt-dlp' komutuna düşer (proje sadece Windows'a kilitli kalmasın diye).
const bundledYtdlBinary = path.join(__dirname, '../../bin/yt-dlp.exe');
const ytdlBinary = (process.platform === 'win32' && fs.existsSync(bundledYtdlBinary)) ? bundledYtdlBinary : 'yt-dlp';

// Sunucu bazlı müzik kuyrukları (guildId -> queue)
const queues = new Map();

function getQueue(guildId) {
    return queues.get(guildId);
}

// Evrensel Metadata Çekici (YouTube, Instagram, TikTok, Twitter, vb.)
function fetchUniversalMetadata(urlOrQuery) {
    return new Promise((resolve) => {
        const isUrl = urlOrQuery.startsWith('http://') || urlOrQuery.startsWith('https://');
        const target = isUrl ? urlOrQuery : `ytsearch1:${urlOrQuery}`;

        const proc = spawn(ytdlBinary, [
            '--dump-json',
            '--no-warnings',
            '--flat-playlist',
            target
        ]);

        let output = '';
        proc.stdout.on('data', d => { output += d.toString(); });

        proc.on('close', (code) => {
            if (code === 0 && output.trim()) {
                try {
                    const data = JSON.parse(output.trim());
                    return resolve({
                        title: data.title || 'Müzik Parçası',
                        url: data.webpage_url || data.url || target,
                        duration: data.duration_string || (data.duration ? `${Math.floor(data.duration / 60)}:${String(data.duration % 60).padStart(2, '0')}` : 'Bilinmiyor'),
                        uploader: data.uploader || data.channel || '',
                        thumbnail: data.thumbnail || (Array.isArray(data.thumbnails) ? data.thumbnails.at(-1)?.url : null) || null
                    });
                } catch {}
            }

            // yt-dlp ile bulunamazsa varsayılan döndür
            resolve({
                title: isUrl ? 'Medya Bağlantısı' : urlOrQuery,
                url: urlOrQuery,
                duration: 'Bilinmiyor',
                uploader: ''
            });
        });

        proc.on('error', () => {
            resolve({
                title: urlOrQuery,
                url: urlOrQuery,
                duration: 'Bilinmiyor',
                uploader: ''
            });
        });
    });
}

// Evrensel Ses Akışı Oluşturucu (Herhangi bir linkten FFmpeg uyumlu stream)
function createUniversalStream(urlOrQuery) {
    const isUrl = urlOrQuery.startsWith('http://') || urlOrQuery.startsWith('https://');
    const target = isUrl ? urlOrQuery : `ytsearch1:${urlOrQuery}`;

    const proc = spawn(ytdlBinary, [
        '-o', '-',
        '-f', 'bestaudio/best',
        '--no-warnings',
        '--no-playlist',
        target
    ]);

    // Eskiden buradaki hatalar hiç takip edilmiyordu: yt-dlp sessizce başarısız olursa
    // (rate-limit, format hatası, ağ kesintisi vb.) hiçbir hata görünmüyor, sadece ses gelmiyordu.
    // stderr'i biriktiriyoruz ki playSong() gerçek hatayı loglayıp kullanıcıyı bilgilendirebilsin.
    proc.__stderrBuffer = '';
    proc.stderr.on('data', d => {
        proc.__stderrBuffer += d.toString();
        if (proc.__stderrBuffer.length > 4000) {
            proc.__stderrBuffer = proc.__stderrBuffer.slice(-4000);
        }
    });

    // stdout'a hiç veri gelmezse (bağlantı takıldı, format çıktı vermedi vb.) bunu da işaretliyoruz
    proc.__bytesReceived = 0;
    proc.stdout.on('data', d => { proc.__bytesReceived += d.length; });

    return proc;
}

// "Şimdi Oynatılıyor" bildirimi için embed + kontrol butonları oluşturur (duraklat/geç/tekrar/karıştır/durdur)
function buildNowPlayingPayload(queue, song) {
    const embed = new EmbedBuilder()
        .setColor(0x1DB954)
        .setTitle('🎶 Şimdi Oynatılıyor')
        .setDescription(`**[${song.title}](${song.url})**`)
        .addFields(
            { name: '⏱️ Süre', value: song.duration || 'Bilinmiyor', inline: true },
            { name: '🙋 İsteyen', value: song.requester, inline: true },
            { name: '🔁 Tekrar', value: queue.loop ? 'Açık' : 'Kapalı', inline: true }
        );
    if (song.thumbnail) embed.setThumbnail(song.thumbnail);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music_pauseresume').setEmoji('⏯️').setLabel('Duraklat/Devam').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setLabel('Geç').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setLabel('Tekrar').setStyle(queue.loop ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_shuffle').setEmoji('🔀').setLabel('Karıştır').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setLabel('Durdur').setStyle(ButtonStyle.Danger)
    );

    return { embed, row };
}

async function playSong(guildId) {
    const queue = queues.get(guildId);
    if (!queue) return;

    if (queue.songs.length === 0) {
        queue.textChannel.send('🎶 Kuyrukta başka parça kalmadı, ses kanalından ayrılıyorum.').catch(() => {});
        if (queue.connection) {
            try { queue.connection.destroy(); } catch {}
        }
        if (queue.activeProcess) {
            try { queue.activeProcess.kill(); } catch {}
        }
        if (queue.activeFfmpeg) {
            try { queue.activeFfmpeg.kill(); } catch {}
        }
        queues.delete(guildId);
        return;
    }

    const song = queue.songs[0];

    try {
        // Önceki çalışan stream işlemini temizle (kasıtlı kill'i işaretle ki hata sanılmasın)
        if (queue.activeProcess) {
            queue.activeProcess.__intentionallyKilled = true;
            try { queue.activeProcess.kill(); } catch {}
        }
        if (queue.activeFfmpeg) {
            try { queue.activeFfmpeg.kill(); } catch {}
            queue.activeFfmpeg = null;
        }

        const streamProcess = createUniversalStream(song.url);
        queue.activeProcess = streamProcess;

        // yt-dlp süreci hiç veri üretmeden veya hata koduyla kapanırsa artık sessizce yutulmuyor:
        // gerçek stderr çıktısını loglayıp kanalda görünür bir hata veriyoruz ve sıradaki şarkıya geçiyoruz.
        streamProcess.on('error', (err) => {
            if (streamProcess.__intentionallyKilled) return;
            console.error(`yt-dlp süreç hatası (${song.title}):`, err.message);
        });

        streamProcess.on('close', (code) => {
            if (streamProcess.__intentionallyKilled) return;
            if (streamProcess !== queue.activeProcess) return; // zaten sıradaki şarkıya geçilmiş
            if (code !== 0 || streamProcess.__bytesReceived === 0) {
                console.error(
                    `yt-dlp ses akışı başarısız oldu (${song.title}, çıkış kodu: ${code}, alınan byte: ${streamProcess.__bytesReceived}):\n` +
                    (streamProcess.__stderrBuffer || '(stderr boş)')
                );
                queue.textChannel.send(
                    `⚠️ **${song.title}** için ses akışı alınamadı (yt-dlp hatası), bir sonraki parçaya geçiliyor.\n` +
                    `*Bu link için sürekli tekrarlanıyorsa yt-dlp güncel olmayabilir veya video kısıtlı/engelli olabilir.*`
                ).catch(() => {});
                if (queue.songs[0] === song) {
                    queue.songs.shift();
                    playSong(guildId);
                }
            }
        });

        // Süreç açılıp hiç ses verisi üretmeden takılı kalırsa (ağ/format sorunu) sonsuza kadar
        // "çalıyor" görünüp sessiz kalmasın diye 10 sn içinde ilk byte gelmezse akışı iptal ediyoruz.
        const stallTimeout = setTimeout(() => {
            if (streamProcess.__bytesReceived === 0 && !streamProcess.__intentionallyKilled) {
                console.warn(`yt-dlp 10 sn içinde veri üretmedi, iptal ediliyor (${song.title}).`);
                try { streamProcess.kill(); } catch {}
            }
        }, 10_000);
        streamProcess.once('close', () => clearTimeout(stallTimeout));

        // Ses efekti (bassboost/nightcore) açıksa yt-dlp çıktısı ffmpeg'den geçirilip filtrelenir;
        // kapalıysa (varsayılan) gereksiz bir ffmpeg süreci açılmadan doğrudan ham akış kullanılır.
        let audioSource = streamProcess.stdout;
        let audioInputType = StreamType.Arbitrary;
        if (queue.effect && EFFECT_FILTERS[queue.effect]) {
            const ffmpegProcess = spawn(ffmpegPath, [
                '-i', 'pipe:0',
                '-af', EFFECT_FILTERS[queue.effect],
                '-f', 's16le', '-ar', '48000', '-ac', '2',
                'pipe:1'
            ]);
            streamProcess.stdout.pipe(ffmpegProcess.stdin);
            ffmpegProcess.stdin.on('error', () => {}); // yt-dlp erken kapanırsa EPIPE'i yut
            ffmpegProcess.on('error', (err) => console.error(`ffmpeg efekt hatası (${song.title}):`, err.message));
            queue.activeFfmpeg = ffmpegProcess;
            audioSource = ffmpegProcess.stdout;
            audioInputType = StreamType.Raw;
        }

        const resource = createAudioResource(audioSource, {
            inputType: audioInputType,
            inlineVolume: true
        });
        if (resource.volume) resource.volume.setVolume(queue.volume ?? 1.0);

        queue.player.play(resource);
        const { embed, row } = buildNowPlayingPayload(queue, song);
        queue.textChannel.send({ embeds: [embed], components: [row] }).catch(() => {});
    } catch (error) {
        console.error('Şarkı oynatılırken hata oluştu:', error);
        queue.textChannel.send(`⚠️ **${song.title}** çalınırken bir hata oluştu, bir sonraki parçaya geçiliyor.`).catch(() => {});
        queue.songs.shift();
        playSong(guildId);
    }
}

async function playQuery(guild, voiceChannel, textChannel, query, requesterName = 'Kullanıcı') {
    try {
        // ÖNCE kuyruk/bağlantı yuvasını SENKRON olarak ayır, SONRA metadata'yı bekle (await).
        // Eskiden sıra tersti: metadata await'i bittikten SONRA "kuyruk var mı" kontrol ediliyordu.
        // İki kullanıcı hiç kuyruk yokken neredeyse aynı anda /oynat çağırırsa, ikisi de await
        // sırasında "kuyruk yok" görüp bağımsız iki joinVoiceChannel()+createAudioPlayer() açıyor,
        // ikinci queues.set() ilkini sessizce eziyordu — ilk bağlantı hiçbir yerden takip edilmeden
        // askıda kalıyordu (leak). Artık yuvayı await'ten ÖNCE ayırdığımız için ikinci çağrı,
        // birincinin az önce oluşturduğu queue'yu görüp ona katılıyor.
        let queue = queues.get(guild.id);
        const isNewQueue = !queue;

        if (isNewQueue) {
            // Yuvayı BURADA, hiçbir await'ten önce, senkron olarak rezerve ediyoruz. Node
            // tek-thread'li olduğu için bu satırdan sonraki ilk await'e kadar başka hiçbir
            // playQuery() çağrısı araya giremez — bu yüzden aşağıdaki (isteğe bağlı) müzik botu
            // adaptör çözümlemesi await'i BİLE artık güvenli: ikinci eşzamanlı çağrı bu placeholder'ı
            // görüp ona katılır, kendi bağlantısını açmaz.
            queue = {
                textChannel: textChannel,
                voiceChannel: voiceChannel,
                connection: null,
                player: null,
                activeProcess: null,
                activeFfmpeg: null,
                songs: [],
                volume: 1.0,
                loop: false,
                skipRequested: false,
                effect: 'none',
                voteSkips: new Set()
            };
            queues.set(guild.id, queue);

            // Ayrı bir müzik botu ayarlıysa (MUSIC_BOT_TOKEN) ses bağlantısı ONUN üzerinden kurulur,
            // böylece ana bot aynı anda radyo/TTS/sesle-komut için kendi bağlantısını kullanabilir.
            // Ayarlı değilse eskisi gibi ana bota (context.guild) düşer.
            const musicClient = getMusicClient();
            let adapterCreator = guild.voiceAdapterCreator;
            if (musicClient) {
                const musicGuild = await musicClient.guilds.fetch(guild.id).catch(() => null);
                if (musicGuild) {
                    adapterCreator = musicGuild.voiceAdapterCreator;
                }
            }

            const player = createAudioPlayer();
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator,
                selfDeaf: true
            });

            // Reasign etmiyoruz, DOLDURUYORUZ — obje zaten queues Map'inde, olası eşzamanlı
            // çağrılar aynı referansı paylaşıyor olsun diye.
            queue.connection = connection;
            queue.player = player;

            connection.subscribe(player);

            player.on(AudioPlayerStatus.Idle, () => {
                // Tekrar (loop) modu açıksa ve kullanıcı elle atlamadıysa aynı şarkı kuyruktan
                // çıkarılmadan yeniden çalınır; aksi halde normal şekilde sıradakine geçilir.
                if (queue.loop && !queue.skipRequested && queue.songs.length > 0) {
                    // şarkı kuyrukta kalır, tekrar çalınacak
                } else if (queue.songs.length > 0) {
                    queue.songs.shift();
                }
                queue.skipRequested = false;
                queue.voteSkips.clear();
                playSong(guild.id);
            });

            player.on('error', error => {
                console.error('Player Hatası:', error);
                if (queue.songs.length > 0) {
                    queue.songs.shift();
                }
                playSong(guild.id);
            });

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                } catch {
                    if (queue.activeProcess) {
                        try { queue.activeProcess.kill(); } catch {}
                    }
                    if (queue.activeFfmpeg) {
                        try { queue.activeFfmpeg.kill(); } catch {}
                    }
                    try { connection.destroy(); } catch {}
                    queues.delete(guild.id);
                }
            });
        }

        if (queue.songs.length >= MAX_QUEUE_SIZE) {
            return `❌ Kuyruk dolu (en fazla ${MAX_QUEUE_SIZE} şarkı taşıyabilir), önce birkaç şarkının bitmesini bekle.`;
        }

        // 1. Evrensel Motor ile Metadata Çek (YouTube, Instagram, TikTok, SoundCloud vb.)
        const songInfo = await fetchUniversalMetadata(query);

        if (!songInfo || !songInfo.url) {
            // Bu, az önce BİZİM oluşturduğumuz ve içine hiç şarkı eklenememiş boş bir kuyruksa
            // (yeni bağlantı ama yayınlanacak hiçbir şey yok), askıda kalan bağlantıyı temizle.
            if (isNewQueue && queue.songs.length === 0) {
                try { queue.connection.destroy(); } catch {}
                queues.delete(guild.id);
            }
            return '❌ Çalınacak müzik veya medya bağlantısı bulunamadı!';
        }

        const song = {
            ...songInfo,
            requester: requesterName
        };

        queue.songs.push(song);

        if (isNewQueue) {
            playSong(guild.id);
            return `🎶 Müzik başlatılıyor: **${song.title}** (${song.duration})`;
        } else {
            return `✅ Kuyruğa eklendi: **${song.title}** (${song.duration})`;
        }
    } catch (err) {
        console.error('Arama/Oynatma Hatası:', err);
        return `❌ Müzik başlatılırken hata oluştu: ${err.message}`;
    }
}

// Kullanıcı elle "geç" dediğinde tekrar (loop) modu aktif olsa bile aynı şarkıya takılı kalmasın diye
// skipRequested bayrağı ile Idle handler'a "bu sefer kesin ilerle" bilgisini veriyoruz.
function skipSong(guildId) {
    const queue = queues.get(guildId);
    if (!queue || !queue.songs || queue.songs.length === 0) return null;
    const skipped = queue.songs[0];
    queue.skipRequested = true;
    queue.player.stop();
    return skipped;
}

function setVolume(guildId, percent) {
    const queue = queues.get(guildId);
    if (!queue) return null;
    const clamped = Math.min(Math.max(percent, 0), 200);
    queue.volume = clamped / 100;
    const currentResource = queue.player.state.resource;
    if (currentResource?.volume) currentResource.volume.setVolume(queue.volume);
    return clamped;
}

// Şarkıyı duraklatır veya devam ettirir, sonucu string olarak döner ('paused'/'resumed'/null)
function togglePause(guildId) {
    const queue = queues.get(guildId);
    if (!queue) return null;
    if (queue.player.state.status === AudioPlayerStatus.Paused) {
        queue.player.unpause();
        return 'resumed';
    }
    queue.player.pause();
    return 'paused';
}

// Kuyruktaki (0. index şu an çalan hariç) belirli bir sıradaki şarkıyı çıkarır
function removeFromQueue(guildId, index) {
    const queue = queues.get(guildId);
    if (!queue || !queue.songs || index < 1 || index >= queue.songs.length) return null;
    return queue.songs.splice(index, 1)[0];
}

// Kuyruğu tamamen boşaltıp mevcut şarkıyı durdurur; Idle handler kalan boş kuyruğu görüp botu kanaldan çıkarır
function stopMusic(guildId) {
    const queue = queues.get(guildId);
    if (!queue) return false;
    queue.songs = [];
    queue.loop = false;
    try { queue.player.stop(); } catch {}
    return true;
}

// Efekti değiştirir. Efekt anlık ses akışını dönüştürdüğü için mevcut şarkı kaldığı yerden değil
// baştan yeniden başlatılır (seek desteği yok) — bilinen ve kabul edilebilir bir kısıt.
function setEffect(guildId, effect) {
    const queue = queues.get(guildId);
    if (!queue) return null;
    queue.effect = effect;
    if (queue.songs.length > 0) playSong(guildId);
    return queue.effect;
}

// Ses kanalındaki bot-olmayan üyelerin çoğunluğu oy verince şarkı atlanır. requireSameVoiceChannel
// ile aynı "botla aynı kanalda olma" kısıtı burada da geçerli (voiceChannel üyeleri sayılıyor).
function voteSkip(guildId, userId, voiceChannel) {
    const queue = queues.get(guildId);
    if (!queue || !queue.songs || queue.songs.length === 0) return { ok: false, reason: 'no_song' };

    queue.voteSkips.add(userId);
    const votersNeeded = Math.max(1, Math.ceil((voiceChannel.members.filter(m => !m.user.bot).size) / 2));
    const votesSoFar = queue.voteSkips.size;

    if (votesSoFar >= votersNeeded) {
        const skipped = queue.songs[0];
        queue.skipRequested = true;
        queue.voteSkips.clear();
        queue.player.stop();
        return { ok: true, skipped, votesSoFar, votersNeeded };
    }
    return { ok: false, reason: 'pending', votesSoFar, votersNeeded };
}

function toggleLoop(guildId) {
    const queue = queues.get(guildId);
    if (!queue) return null;
    queue.loop = !queue.loop;
    return queue.loop;
}

function shuffleQueue(guildId) {
    const queue = queues.get(guildId);
    if (!queue || !queue.songs || queue.songs.length <= 2) return 0;

    // İlk eleman (şu an çalan şarkı) yerinde kalır, sadece geri kalan kuyruk karıştırılır
    const [current, ...rest] = queue.songs;
    for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    queue.songs = [current, ...rest];
    return rest.length;
}

async function handlePlay(interaction, query) {
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
        return interaction.reply({ content: '❌ Bir ses kanalında olmalısınız!', ephemeral: true });
    }

    // Ses bağlantısını asıl kuracak olan bot (ikinci müzik botu ayarlıysa o, değilse ana bot)
    // üzerinden yetki kontrolü yapılır.
    const musicClient = getMusicClient();
    let botMember;
    if (musicClient) {
        botMember = await interaction.guild.members.fetch(musicClient.user.id).catch(() => null);
        if (!botMember) {
            return interaction.reply({ content: '❌ Müzik botu bu sunucuda bulunamadı. Sunucuya davet edildiğinden emin olun.', ephemeral: true });
        }
    } else {
        botMember = interaction.client.user;
    }

    const permissions = voiceChannel.permissionsFor(botMember);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
        return interaction.reply({ content: '❌ Müzik botunun bu kanala bağlanma veya konuşma yetkisi yok!', ephemeral: true });
    }

    await interaction.deferReply();
    const result = await playQuery(interaction.guild, voiceChannel, interaction.channel, query, interaction.user.tag);
    await interaction.editReply(result);
}

// Çalma kontrol komutlarının (durdur/devam/gec/tekrar/ses-seviyesi/karistir/kuyruktan-cikar/ayril)
// hiçbiri çağıranın botla AYNI ses kanalında olup olmadığını kontrol etmiyordu — sohbet kanalında
// oturan, hatta hiç sesli bağlanmamış herhangi bir üye başkasının müziğini durdurabiliyor, botu
// kanaldan atabiliyordu. Yöneticiler bu kısıtlamadan muaf (moderasyon amaçlı /durdur vb. hâlâ işe
// yarasın diye).
function requireSameVoiceChannel(interaction, queue) {
    if (!queue) return { ok: false, reply: '❌ Şu anda aktif bir müzik oturumu yok!' };
    if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return { ok: true };
    const memberVoice = interaction.member.voice.channel;
    if (!memberVoice || memberVoice.id !== queue.voiceChannel?.id) {
        return { ok: false, reply: '❌ Bu komutu kullanmak için botla aynı ses kanalında olmalısın.' };
    }
    return { ok: true };
}

module.exports = {
    getQueue,
    handlePlay,
    playQuery,
    skipSong,
    setVolume,
    toggleLoop,
    shuffleQueue,
    togglePause,
    removeFromQueue,
    stopMusic,
    requireSameVoiceChannel,
    setEffect,
    voteSkip,
    queues
};
