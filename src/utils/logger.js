// Dosyaya yazan basit uygulama logu (logs/YYYY-MM-DD.log). Konsola yazmayı da korur.
const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

function todayFile() {
    const day = new Date().toISOString().slice(0, 10);
    return path.join(logsDir, `${day}.log`);
}

function writeLine(level, message) {
    const line = `[${new Date().toISOString()}] [${level}] ${message}\n`;
    try {
        fs.appendFileSync(todayFile(), line, 'utf-8');
    } catch (err) {
        console.error('[logger] Log dosyasına yazılamadı:', err.message);
    }
}

function info(message) {
    console.log(message);
    writeLine('INFO', message);
}

function warn(message) {
    console.warn(message);
    writeLine('WARN', message);
}

function error(message, err) {
    console.error(message, err !== undefined ? err : '');
    const detail = err ? (err.stack || err.message || String(err)) : '';
    writeLine('ERROR', detail ? `${message} :: ${detail}` : message);
}

module.exports = { info, warn, error };
