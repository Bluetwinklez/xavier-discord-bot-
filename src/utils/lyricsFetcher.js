// lyrics.ovh üzerinden şarkı sözü çeker (ücretsiz, API anahtarı gerekmiyor). Bizdeki şarkı
// başlıkları "Sanatçı - Şarkı Adı" formatında değil (yt-dlp video başlığı, "(Official Video)" gibi
// ekler taşıyabiliyor) — bu yüzden önce /suggest ile serbest metin aramasıyla en uygun sanatçı/şarkı
// eşleşmesi bulunuyor, sonra gerçek sözler /v1 ile çekiliyor.
async function fetchLyrics(rawTitle) {
    const cleaned = rawTitle.replace(/\(.*?\)|\[.*?\]/g, '').trim();
    if (!cleaned) return null;

    try {
        const suggestRes = await fetch(`https://api.lyrics.ovh/suggest/${encodeURIComponent(cleaned)}`);
        if (!suggestRes.ok) return null;
        const suggestData = await suggestRes.json();
        const track = suggestData?.data?.[0];
        if (!track?.artist?.name || !track?.title) return null;

        const lyricsRes = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(track.artist.name)}/${encodeURIComponent(track.title)}`);
        if (!lyricsRes.ok) return null;
        const lyricsData = await lyricsRes.json();
        if (!lyricsData?.lyrics) return null;

        return { artist: track.artist.name, title: track.title, lyrics: lyricsData.lyrics.trim() };
    } catch {
        return null;
    }
}

module.exports = { fetchLyrics };
