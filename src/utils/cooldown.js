// Genel amaçlı kullanıcı başına basit istek aralığı (spam koruması).
const timestamps = new Map(); // "namespace:userId" -> son istek zamanı

function checkCooldown(namespace, userId, ms) {
    const key = `${namespace}:${userId}`;
    const now = Date.now();
    const last = timestamps.get(key);
    if (last && now - last < ms) {
        return ms - (now - last);
    }
    timestamps.set(key, now);
    return 0;
}

module.exports = { checkCooldown };
