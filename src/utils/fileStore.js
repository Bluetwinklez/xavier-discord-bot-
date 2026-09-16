// Ortak JSON dosya okuma/yazma yardımcısı (atomik yazım: geçici dosyaya yazıp yeniden adlandırır)
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');

function ensureDataDir() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

function readJSON(fileName, fallback = {}) {
    ensureDataDir();
    const filePath = path.join(dataDir, fileName);
    if (!fs.existsSync(filePath)) {
        writeJSON(fileName, fallback);
        return fallback;
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw || 'null') ?? fallback;
    } catch (err) {
        console.error(`[fileStore] ${fileName} okunurken hata:`, err.message);
        return fallback;
    }
}

function writeJSON(fileName, data) {
    ensureDataDir();
    const filePath = path.join(dataDir, fileName);
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    try {
        // Atomik yazım: önce geçici dosyaya yaz, sonra rename et.
        // Yazma sırasında process çökerse asıl dosya bozulmaz.
        fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
        fs.renameSync(tmpPath, filePath);
        return true;
    } catch (err) {
        console.error(`[fileStore] ${fileName} yazılırken hata:`, err.message);
        try { fs.unlinkSync(tmpPath); } catch {}
        return false;
    }
}

module.exports = { readJSON, writeJSON };
