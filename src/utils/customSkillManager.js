const { readJSON, writeJSON } = require('./fileStore');

const SKILLS_FILE = 'customSkills.json';
// Sunucu başına öğrenilen özel komut/bilgi sayısına eskiden hiç sınır yoktu — sınırsız
// büyüyebiliyordu VE her AI isteğinde (getKnowledgePromptSnippet ile) TÜM öğrenilen bilgi sistem
// promptuna ekleniyordu, yani zamanla her mesajın token maliyeti orantısız artardı. Sınıra
// ulaşılınca en eski kayıt (addedAt'e göre) otomatik düşürülür.
const MAX_ITEMS_PER_GUILD = 75;

function enforceLimit(list) {
    if (list.length <= MAX_ITEMS_PER_GUILD) return;
    list.sort((a, b) => a.addedAt - b.addedAt);
    list.splice(0, list.length - MAX_ITEMS_PER_GUILD);
}

function loadAllSkills() {
    return readJSON(SKILLS_FILE, {});
}

function saveAllSkills(data) {
    writeJSON(SKILLS_FILE, data);
}

function getGuildSkills(guildId) {
    const all = loadAllSkills();
    return all[guildId] || { commands: [], knowledge: [] };
}

function addCustomCommand(guildId, trigger, response) {
    const all = loadAllSkills();
    if (!all[guildId]) all[guildId] = { commands: [], knowledge: [] };

    // Varsa güncelle, yoksa ekle
    const cleanTrigger = trigger.toLowerCase().trim();
    const existingIndex = all[guildId].commands.findIndex(c => c.trigger.toLowerCase() === cleanTrigger);

    if (existingIndex >= 0) {
        all[guildId].commands[existingIndex].response = response;
    } else {
        all[guildId].commands.push({ trigger: cleanTrigger, response, addedAt: Date.now() });
        enforceLimit(all[guildId].commands);
    }
    saveAllSkills(all);
}

function addKnowledge(guildId, topic, content) {
    const all = loadAllSkills();
    if (!all[guildId]) all[guildId] = { commands: [], knowledge: [] };

    const cleanTopic = (topic || 'Genel').trim();
    const existingIndex = all[guildId].knowledge.findIndex(k => k.topic.toLowerCase() === cleanTopic.toLowerCase());

    if (existingIndex >= 0) {
        all[guildId].knowledge[existingIndex].content = content;
    } else {
        all[guildId].knowledge.push({ topic: cleanTopic, content, addedAt: Date.now() });
        enforceLimit(all[guildId].knowledge);
    }
    saveAllSkills(all);
}

function removeSkill(guildId, keyword) {
    const all = loadAllSkills();
    if (!all[guildId]) return false;

    const clean = keyword.toLowerCase().trim();
    const prevCmdLen = all[guildId].commands.length;
    all[guildId].commands = all[guildId].commands.filter(c => !c.trigger.toLowerCase().includes(clean));

    const prevKnwLen = all[guildId].knowledge.length;
    all[guildId].knowledge = all[guildId].knowledge.filter(k => !k.topic.toLowerCase().includes(clean));

    const changed = all[guildId].commands.length !== prevCmdLen || all[guildId].knowledge.length !== prevKnwLen;
    if (changed) saveAllSkills(all);
    return changed;
}

function getKnowledgePromptSnippet(guildId) {
    const skills = getGuildSkills(guildId);
    if (!skills.knowledge || skills.knowledge.length === 0) return '';

    const lines = skills.knowledge.map(k => `• ${k.topic}: ${k.content}`);
    return `\n\nSUNUCUYA ÖZEL ÖĞRENDİĞİN KALICI BİLGİLER (Kullanıcılar sorarsa bu bilgileri kullan):\n${lines.join('\n')}`;
}

module.exports = {
    getGuildSkills,
    addCustomCommand,
    addKnowledge,
    removeSkill,
    getKnowledgePromptSnippet
};
