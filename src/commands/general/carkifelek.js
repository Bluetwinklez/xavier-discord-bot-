const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { addBalance, getBalance } = require('../../utils/economyManager');
const { readJSON, writeJSON } = require('../../utils/fileStore');
const { checkAndNotify: checkBadges } = require('../../utils/badgeManager');

const FILE_NAME = 'wheel.json';
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 saat
// Art arda kaçırmadan çevirmeyi teşvik eden günlük seri bonusu: 48 saat içinde tekrar çevrilirse
// seri devam eder, aksi halde 1'e sıfırlanır. Bonus, seri uzunluğuyla artar ama tavanlanır (çarkın
// asıl ödülünü gölgelemesin diye).
const STREAK_RESET_MS = 48 * 60 * 60 * 1000;
const STREAK_BONUS_PER_DAY = 20;
const STREAK_BONUS_CAP = 300;

const PRIZES = [
    { name: '50 💰 Coin', amount: 50, type: 'coin', icon: '🥉', weight: 35 },
    { name: '150 💰 Coin', amount: 150, type: 'coin', icon: '🥈', weight: 30 },
    { name: '300 💰 Coin', amount: 300, type: 'coin', icon: '🥇', weight: 20 },
    { name: '1.000 💰 BÜYÜK İKRAMİYE!', amount: 1000, type: 'coin', icon: '💎', weight: 10 },
    { name: '500 💰 Şanslı Kasa!', amount: 500, type: 'coin', icon: '🎁', weight: 5 }
];

function pickRandomPrize() {
    const totalWeight = PRIZES.reduce((sum, p) => sum + p.weight, 0);
    let rand = Math.random() * totalWeight;
    for (const prize of PRIZES) {
        if (rand < prize.weight) return prize;
        rand -= prize.weight;
    }
    return PRIZES[0];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('carkifelek')
        .setDescription('Günde 1 kez şans çarkını çevirerek sürpriz hediyeler ve coin kazanın!'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const now = Date.now();

        const allWheel = readJSON(FILE_NAME, {});
        const key = `${guildId}:${userId}`;
        // Eski kayıtlar düz timestamp (number) olarak saklanıyordu — yeni {lastSpin, streak} şekliyle
        // geriye dönük uyumlu okunuyor.
        const record = allWheel[key];
        const prevEntry = typeof record === 'number' ? { lastSpin: record, streak: 1 } : (record || { lastSpin: 0, streak: 0 });

        if (prevEntry.lastSpin && now - prevEntry.lastSpin < COOLDOWN_MS) {
            const nextSpinTimestamp = Math.floor((prevEntry.lastSpin + COOLDOWN_MS) / 1000);
            return interaction.reply({
                content: `⏳ Çarkıfeleği bugün zaten çevirdiniz! Bir sonraki çevirme hakkınız: <t:${nextSpinTimestamp}:R> (<t:${nextSpinTimestamp}:T>).`,
                ephemeral: true
            });
        }

        const keepsStreak = prevEntry.lastSpin && (now - prevEntry.lastSpin) < STREAK_RESET_MS;
        const newStreak = keepsStreak ? prevEntry.streak + 1 : 1;
        const streakBonus = Math.min(newStreak * STREAK_BONUS_PER_DAY, STREAK_BONUS_CAP);

        // Çarkı çevir
        const won = pickRandomPrize();
        const totalAmount = won.amount + streakBonus;
        allWheel[key] = { lastSpin: now, streak: newStreak };
        writeJSON(FILE_NAME, allWheel);

        addBalance(guildId, userId, totalAmount);
        const newBalance = getBalance(guildId, userId);
        checkBadges(interaction.guild, interaction.member);

        const streakLine = streakBonus > 0
            ? `🔥 **Seri Bonusu (${newStreak} gün):** \`+${streakBonus} 💰\`\n`
            : '';

        const embed = new EmbedBuilder()
            .setColor(won.amount >= 500 ? 0xF1C40F : 0x00FF88)
            .setTitle('🎡 Şans Çarkıfeleği Döndü!')
            .setDescription(`
╔═════════════════════════════╗
║  ${won.icon} **${won.name}**  ║
╚═════════════════════════════╝
            ▲ **İbre Kazandığınız Ödülü Gösteriyor!**

🎉 **Tebrikler ${interaction.user}!**
🎁 **Kazanılan Ödül:** \`+${won.amount} 💰\`
${streakLine}💳 **Güncel Bakiyeniz:** \`${newBalance} 💰\`

*Bir sonraki çevirme hakkınız yarın açılacaktır (48 saat içinde çevirmezsen serin sıfırlanır).*
            `)
            .setFooter({ text: `${interaction.guild.name} Günlük Çarkıfelek` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
