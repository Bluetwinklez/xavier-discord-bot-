const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getBalance, addBalance } = require('../../utils/economyManager');

const ICONS = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slot')
        .setDescription('Slot makinesinde şansınızı deneyin ve jeton kazanın!')
        .addIntegerOption(opt =>
            opt.setName('miktar')
                .setDescription('Bahis miktarı (en az 10)')
                .setMinValue(10)
                .setRequired(true)
        ),

    async execute(interaction) {
        const bet = interaction.options.getInteger('miktar');
        const currentBalance = getBalance(interaction.guildId, interaction.user.id);

        if (currentBalance < bet) {
            return interaction.reply({
                content: `❌ Yetersiz bakiye! Mevcut bakiyeniz: **${currentBalance} 💰**, oynamak istediğiniz: **${bet} 💰**.`,
                ephemeral: true
            });
        }

        // Bahis miktarını düş
        addBalance(interaction.guildId, interaction.user.id, -bet);

        // 3 çark çevir
        const reel1 = ICONS[Math.floor(Math.random() * ICONS.length)];
        const reel2 = ICONS[Math.floor(Math.random() * ICONS.length)];
        const reel3 = ICONS[Math.floor(Math.random() * ICONS.length)];

        let multiplier = 0;
        let resultText = '';

        // Çarpanlar: 6 sembol x 3 çark = 216 kombinasyon. İkili eşleşme 90/216 (%41.6) ihtimalle
        // geliyor, bu yüzden eski 2x çarpanı TEK BAŞINA ~%83 RTP demekti; üçlü eşleşmelerle (6/216)
        // birleşince toplam beklenen getiri bahsin ÜZERİNE çıkıyordu (~%104 RTP — sürekli oynayarak
        // garanti kâr). İkili eşleşmeyi 1x (bahis iadesi) yapıp üçlü ödülleri buna göre ayarladık;
        // toplam RTP artık ~%75 (216 kombinasyon üzerinden: 90*1 + 25 + 15 + 4*8 = 162/216).
        if (reel1 === reel2 && reel2 === reel3) {
            if (reel1 === '7️⃣') {
                multiplier = 25;
                resultText = '💥 **JACKPOT!** 3 Tane 7️⃣ tutturdun! (25x)';
            } else if (reel1 === '💎') {
                multiplier = 15;
                resultText = '💎 **ELMAS KAZANÇ!** 3 Tane Elmas tutturdun! (15x)';
            } else {
                multiplier = 8;
                resultText = '🎉 **BÜYÜK KAZANÇ!** 3 Sembol de eşleşti! (8x)';
            }
        } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
            multiplier = 1;
            resultText = '✨ **İKİLİ EŞLEŞME!** Bahsin iade edildi. (1x)';
        } else {
            multiplier = 0;
            resultText = '😢 **Kaybettin!** Şansını bir dahaki sefere tekrar dene.';
        }

        const winAmount = bet * multiplier;
        if (winAmount > 0) {
            addBalance(interaction.guildId, interaction.user.id, winAmount);
        }

        const finalBalance = getBalance(interaction.guildId, interaction.user.id);

        const embed = new EmbedBuilder()
            .setColor(multiplier > 0 ? 0xF1C40F : 0xE74C3C)
            .setTitle('🎰 Slot Makinesi')
            .setDescription(`
╔═════════════════╗
║  [ ${reel1} | ${reel2} | ${reel3} ]  ║
╚═════════════════╝

${resultText}

💰 **Yatırılan Bahis:** \`${bet}\` 💰
🏆 **Kazanılan Miktar:** \`${winAmount}\` 💰
💳 **Güncel Bakiye:** \`${finalBalance}\` 💰
            `)
            .setFooter({ text: `Oyuncu: ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
