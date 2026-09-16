// Geçici ses odalarını hafızada VE diskte tutan yönetici (channelId -> { ownerId, guildId })
// Disk kaydı sayesinde bot yeniden başlasa dahi aktif geçici odalar "temp" olarak tanınmaya devam eder.
const { readJSON, writeJSON } = require('./fileStore');

const TEMP_VOICE_FILE = 'tempVoiceRooms.json';

const stored = readJSON(TEMP_VOICE_FILE, {});
const tempVoiceRooms = new Map(Object.entries(stored));

function persist() {
    writeJSON(TEMP_VOICE_FILE, Object.fromEntries(tempVoiceRooms));
}

function addTempVoice(channelId, ownerId, guildId) {
    tempVoiceRooms.set(channelId, { ownerId, guildId });
    persist();
}

function getTempVoice(channelId) {
    return tempVoiceRooms.get(channelId);
}

function isTempVoice(channelId) {
    return tempVoiceRooms.has(channelId);
}

function removeTempVoice(channelId) {
    const existed = tempVoiceRooms.delete(channelId);
    if (existed) persist();
}

// Bot başlarken artık var olmayan (offlineyken silinmiş) odaları hafızadan temizler.
// AYRICA: kanal hâlâ Discord'da duruyor ama boşsa (son kullanıcı, bot KAPALIYKEN ayrıldıysa
// voiceStateUpdate hiç tetiklenmediği için normal otomatik-silme mantığı hiç çalışmamıştır) o
// kanalı da siler — aksi halde kimse tekrar girip çıkmadıkça süresiz kalıcı boş oda kalırdı.
async function pruneMissingChannels(client) {
    let changed = false;
    for (const [channelId, data] of [...tempVoiceRooms]) {
        const guild = client.guilds.cache.get(data.guildId);
        const channel = guild?.channels.cache.get(channelId);
        if (!channel) {
            tempVoiceRooms.delete(channelId);
            changed = true;
        } else if (channel.members.size === 0) {
            tempVoiceRooms.delete(channelId);
            changed = true;
            await channel.delete('Geçici oda, bot kapalıyken boşaldığı için açılışta temizlendi.').catch(() => {});
        }
    }
    if (changed) persist();
}

module.exports = {
    tempVoiceRooms,
    addTempVoice,
    getTempVoice,
    isTempVoice,
    removeTempVoice,
    pruneMissingChannels
};
