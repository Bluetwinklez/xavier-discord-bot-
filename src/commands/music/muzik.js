const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { handlePlay, getQueue, queues, requireSameVoiceChannel, setEffect, voteSkip } = require('../../utils/musicManager');
const { playRadio, cleanupVoice } = require('../../utils/radioCatalog');
const { checkCooldown } = require('../../utils/cooldown');
const { fetchLyrics } = require('../../utils/lyricsFetcher');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('muzik')
        .setDescription('Kapsamlı müzik ve canlı radyo sistemi')
        .addSubcommand(sub =>
            sub.setName('oynat')
                .setDescription('Bir şarkı veya müzik aratıp ses kanalında çalar')
                .addStringOption(opt =>
                    opt.setName('sarki')
                        .setDescription('Şarkı adı, sanatçı veya müzik ismi')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('durdur')
                .setDescription('Çalan müziği tamamen durdurur ve ses kanalından ayrılır')
        )
        .addSubcommand(sub =>
            sub.setName('duraklat')
                .setDescription('Çalan müziği geçici olarak duraklatır')
        )
        .addSubcommand(sub =>
            sub.setName('devam')
                .setDescription('Duraklatılan müziği kaldığı yerden devam ettirir')
        )
        .addSubcommand(sub =>
            sub.setName('gec')
                .setDescription('Çalan şarkıyı atlar ve sıradaki şarkıya geçer')
        )
        .addSubcommand(sub =>
            sub.setName('kuyruk')
                .setDescription('Mevcut müzik çalma sırasını listeler')
        )
        .addSubcommand(sub =>
            sub.setName('radyo')
                .setDescription('Kesintisiz canlı radyo veya 7/24 Lofi yayını açar')
                .addStringOption(opt =>
                    opt.setName('istasyon')
                        .setDescription('Dinlemek istediğiniz radyo kanalı')
                        .setRequired(true)
                        .addChoices(
                            { name: '🔥 PowerTürk (Türkçe Pop / Hit)', value: 'powerturk' },
                            { name: '🎧 Radyo Fenomen (Yabancı Hit)', value: 'fenomen' },
                            { name: '💖 SlowTürk (Slow Türkçe)', value: 'slowturk' },
                            { name: '📻 Best FM (Karışık Türkçe Pop)', value: 'bestfm' },
                            { name: '☕ 7/24 Lofi Hip Hop (Chill / Çalışma)', value: 'lofi' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('ayril')
                .setDescription('Botu ses kanalından çıkartır')
        )
        .addSubcommand(sub =>
            sub.setName('sozler')
                .setDescription('Şu an çalan şarkının sözlerini gösterir')
        )
        .addSubcommand(sub =>
            sub.setName('efekt')
                .setDescription('Çalan şarkıya ses efekti uygular (baştan başlatır)')
                .addStringOption(opt =>
                    opt.setName('tur')
                        .setDescription('Uygulanacak efekt')
                        .setRequired(true)
                        .addChoices(
                            { name: '🚫 Kapat (Normal)', value: 'none' },
                            { name: '🔊 Bass Boost', value: 'bassboost' },
                            { name: '🌙 Nightcore', value: 'nightcore' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('oy-gec')
                .setDescription('Ses kanalındaki çoğunluk oy verirse şarkıyı atlar')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        const voiceChannel = interaction.member.voice?.channel;

        if (sub === 'oynat') {
            // /oynat komutuyla aynı cooldown korumasına sahip değildi — spam'i kolaylaştırıyordu.
            const cooldownMs = checkCooldown('oynat', interaction.user.id, 3000);
            if (cooldownMs > 0) {
                return interaction.reply({ content: `⏳ Çok hızlı şarkı ekliyorsun, ${Math.ceil(cooldownMs / 1000)} saniye bekle.`, ephemeral: true });
            }
            const query = interaction.options.getString('sarki');
            return handlePlay(interaction, query);
        }

        if (sub === 'radyo') {
            if (!voiceChannel) {
                return interaction.reply({ content: '❌ Canlı radyo açabilmek için bir ses kanalında olmalısınız!', ephemeral: true });
            }
            await interaction.deferReply();
            const stationKey = interaction.options.getString('istasyon');
            const station = await playRadio(voiceChannel, stationKey);
            return interaction.editReply(`📻 **${station.name}** canlı yayını ${voiceChannel.name} kanalında başlatıldı!`);
        }

        // Not: durdur/ayril/duraklat/devam/gec alt komutları ses kanalı üyeliği kontrolü YAPMIYORDU
        // — botla aynı kanalda olmayan (hatta hiç sesli bağlanmamış) herhangi biri başkasının
        // müziğini durdurabiliyor, botu kanaldan atabiliyordu. Bağımsız /durdur, /devam, /gec,
        // /ayril komutlarıyla aynı `requireSameVoiceChannel` kontrolü burada da uygulanıyor.
        if (sub === 'durdur' || sub === 'ayril') {
            const queue = getQueue(guildId);
            if (queue) {
                const check = requireSameVoiceChannel(interaction, queue);
                if (!check.ok) return interaction.reply({ content: check.reply, ephemeral: true });
                if (queue.connection) {
                    try { queue.connection.destroy(); } catch {}
                }
                queues.delete(guildId);
            }
            cleanupVoice(guildId);
            return interaction.reply('⏹️ Müzik ve radyo durduruldu, ses kanalından ayrıldım.');
        }

        if (sub === 'duraklat') {
            const queue = getQueue(guildId);
            if (!queue || !queue.player) {
                return interaction.reply({ content: '❌ Şu anda çalan bir müzik yok.', ephemeral: true });
            }
            const check = requireSameVoiceChannel(interaction, queue);
            if (!check.ok) return interaction.reply({ content: check.reply, ephemeral: true });
            queue.player.pause();
            return interaction.reply('⏸️ Müzik duraklatıldı.');
        }

        if (sub === 'devam') {
            const queue = getQueue(guildId);
            if (!queue || !queue.player) {
                return interaction.reply({ content: '❌ Şu anda duraklatılmış bir müzik yok.', ephemeral: true });
            }
            const check = requireSameVoiceChannel(interaction, queue);
            if (!check.ok) return interaction.reply({ content: check.reply, ephemeral: true });
            queue.player.unpause();
            return interaction.reply('▶️ Müzik devam ettiriliyor.');
        }

        if (sub === 'gec') {
            const queue = getQueue(guildId);
            if (!queue || !queue.songs || queue.songs.length === 0) {
                return interaction.reply({ content: '❌ Kuyrukta atlanacak şarkı yok.', ephemeral: true });
            }
            const check = requireSameVoiceChannel(interaction, queue);
            if (!check.ok) return interaction.reply({ content: check.reply, ephemeral: true });
            queue.player.stop();
            return interaction.reply('⏭️ Sıradaki parçaya geçildi!');
        }

        if (sub === 'kuyruk') {
            const queue = getQueue(guildId);
            if (!queue || !queue.songs || queue.songs.length === 0) {
                return interaction.reply({ content: '📝 Müzik kuyruğu şu anda boş.', ephemeral: true });
            }
            const list = queue.songs.slice(0, 10).map((s, i) => `${i === 0 ? '▶️ **Çalan:**' : `${i}.`} **${s.title}** (${s.duration}) - İsteyen: ${s.requester}`).join('\n');
            const embed = new EmbedBuilder()
                .setTitle('🎶 Müzik Çalma Listesi')
                .setColor(0x5865F2)
                .setDescription(list)
                .setFooter({ text: `Toplam ${queue.songs.length} parça sırada bekliyor.` });

            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'sozler') {
            const queue = getQueue(guildId);
            if (!queue || !queue.songs || queue.songs.length === 0) {
                return interaction.reply({ content: '❌ Şu anda çalan bir şarkı yok.', ephemeral: true });
            }
            await interaction.deferReply();
            const song = queue.songs[0];
            const result = await fetchLyrics(song.title);
            if (!result) {
                return interaction.editReply(`❌ **${song.title}** için söz bulunamadı.`);
            }
            // Embed açıklaması 4096 karakterle sınırlı, uzun sözler kırpılıp not ekleniyor.
            const truncated = result.lyrics.length > 3900;
            const lyricsText = truncated ? result.lyrics.slice(0, 3900) + '\n\n*(...sözler uzun olduğu için kırpıldı)*' : result.lyrics;
            const embed = new EmbedBuilder()
                .setColor(0x1DB954)
                .setTitle(`📜 ${result.artist} - ${result.title}`)
                .setDescription(lyricsText);
            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'efekt') {
            const queue = getQueue(guildId);
            if (!queue || !queue.songs || queue.songs.length === 0) {
                return interaction.reply({ content: '❌ Şu anda çalan bir şarkı yok.', ephemeral: true });
            }
            const check = requireSameVoiceChannel(interaction, queue);
            if (!check.ok) return interaction.reply({ content: check.reply, ephemeral: true });
            const effect = interaction.options.getString('tur');
            setEffect(guildId, effect);
            const labels = { none: '🚫 Normal (efektsiz)', bassboost: '🔊 Bass Boost', nightcore: '🌙 Nightcore' };
            return interaction.reply(`🎛️ Efekt **${labels[effect]}** olarak ayarlandı, şarkı baştan başlatılıyor.`);
        }

        if (sub === 'oy-gec') {
            if (!voiceChannel) {
                return interaction.reply({ content: '❌ Oy kullanmak için bir ses kanalında olmalısın!', ephemeral: true });
            }
            const queue = getQueue(guildId);
            const check = requireSameVoiceChannel(interaction, queue);
            if (!check.ok) return interaction.reply({ content: check.reply, ephemeral: true });

            const result = voteSkip(guildId, interaction.user.id, voiceChannel);
            if (result.reason === 'no_song') {
                return interaction.reply({ content: '❌ Kuyrukta atlanacak şarkı yok.', ephemeral: true });
            }
            if (result.ok) {
                return interaction.reply(`⏭️ Oylama tamamlandı (${result.votesSoFar}/${result.votersNeeded}), şarkı atlanıyor!`);
            }
            return interaction.reply(`🗳️ Oy kaydedildi (${result.votesSoFar}/${result.votersNeeded}). Şarkının atlanması için daha fazla oy gerekiyor.`);
        }
    }
};
