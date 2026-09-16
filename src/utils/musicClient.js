// İkinci (müzik) botun Client referansını tutan basit bir kayıt defteri.
// index.js iki bot da login olduktan sonra setMusicClient() ile burayı doldurur.
// MUSIC_BOT_TOKEN ayarlanmamışsa null kalır ve musicManager ana bota (fallback) düşer.
let musicClient = null;

function setMusicClient(client) {
    musicClient = client;
}

function getMusicClient() {
    return musicClient;
}

module.exports = { setMusicClient, getMusicClient };
