const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getBalance, addBalance } = require('../../utils/economyManager');

const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const VALUES = [
    { name: '2', val: 2 }, { name: '3', val: 3 }, { name: '4', val: 4 },
    { name: '5', val: 5 }, { name: '6', val: 6 }, { name: '7', val: 7 },
    { name: '8', val: 8 }, { name: '9', val: 9 }, { name: '10', val: 10 },
    { name: 'J', val: 10 }, { name: 'Q', val: 10 }, { name: 'K', val: 10 },
    { name: 'A', val: 11 }
];

function drawCard() {
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    const card = VALUES[Math.floor(Math.random() * VALUES.length)];
    return { name: `${card.name}${suit}`, value: card.val, isAce: card.name === 'A' };
}

function calculateHand(hand) {
    let score = 0;
    let aces = 0;
    for (const card of hand) {
        score += card.value;
        if (card.isAce) aces++;
    }
    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }
    return score;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Krupere karşı 21 (Blackjack) kart oyunu oynayın!')
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

        // Bahsi baştan düş
        addBalance(interaction.guildId, interaction.user.id, -bet);

        const playerHand = [drawCard(), drawCard()];
        const dealerHand = [drawCard(), drawCard()];

        let playerScore = calculateHand(playerHand);
        let dealerScore = calculateHand(dealerHand);

        // Anında Blackjack kontrolü — krupiyenin de doğal 21'i olabileceğinden (standart kuralda bu
        // durumda berabere/bahis iadesi olur), eskiden bu kontrol edilmeden her zaman 2.5x ödeniyordu.
        if (playerScore === 21) {
            const isPush = dealerScore === 21;
            const winAmount = isPush ? bet : Math.floor(bet * 2.5);
            addBalance(interaction.guildId, interaction.user.id, winAmount);
            const finalBal = getBalance(interaction.guildId, interaction.user.id);

            const bjEmbed = new EmbedBuilder()
                .setColor(isPush ? 0xF1C40F : 0x00FF88)
                .setTitle(isPush ? '🤝 Karşılıklı Doğal 21! Berabere.' : '🃏 BLACKJACK! Doğal 21!')
                .setDescription(`
**Senin Kartların:** ${playerHand.map(c => c.name).join(' ')} (Skor: **21**)
**Krupiyenin Kartları:** ${dealerHand.map(c => c.name).join(' ')} (Skor: **${dealerScore}**)

${isPush ? '🤝 **Krupiyenin de doğal 21\'i vardı, bahsin iade edildi.**' : '🎉 **Tebrikler! 2.5x Kazanç Elde Ettin!**'}
💰 **${isPush ? 'İade' : 'Kazanılan'}:** \`+${winAmount}\` 💰
💳 **Güncel Bakiye:** \`${finalBal}\` 💰
                `)
                .setTimestamp();

            return interaction.reply({ embeds: [bjEmbed] });
        }

        const buildEmbed = (inProgress = true, statusMessage = '') => {
            const embed = new EmbedBuilder()
                .setColor(inProgress ? 0x3498DB : (statusMessage.includes('Kazandın') ? 0x00FF88 : 0xE74C3C))
                .setTitle('🃏 Blackjack (21)')
                .setDescription(`
**Senin Kartların:** ${playerHand.map(c => c.name).join(' ')} (Skor: **${playerScore}**)
**Krupiyenin Kartları:** ${inProgress ? `${dealerHand[0].name} 🂠 *(Gizli)*` : `${dealerHand.map(c => c.name).join(' ')} (Skor: **${dealerScore}**)`}

💰 **Bahis:** \`${bet}\` 💰
${statusMessage ? `\n${statusMessage}` : ''}
                `)
                .setFooter({ text: inProgress ? 'Kart çekmek için "Kart Çek", durmak için "Kal" butonuna bas.' : 'Oyun sona erdi.' });

            return embed;
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('hit').setLabel('Kart Çek').setEmoji('➕').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('stand').setLabel('Kal (Dur)').setEmoji('🛑').setStyle(ButtonStyle.Secondary)
        );

        const reply = await interaction.reply({ embeds: [buildEmbed(true)], components: [row] });

        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000,
            filter: i => i.user.id === interaction.user.id
        });

        collector.on('collect', async i => {
            if (i.customId === 'hit') {
                playerHand.push(drawCard());
                playerScore = calculateHand(playerHand);

                if (playerScore > 21) {
                    // Battı (Bust)
                    collector.stop('bust');
                    const finalBal = getBalance(interaction.guildId, interaction.user.id);
                    await i.update({
                        embeds: [buildEmbed(false, `💥 **Bust! 21'i aştın ve kaybettin.**\n💳 Güncel Bakiye: \`${finalBal}\` 💰`)],
                        components: []
                    });
                } else if (playerScore === 21) {
                    // Discord, buton etkileşiminin 3sn içinde onaylanmasını zorunlu tutar; 'end'
                    // handler'ı asıl mesajı biraz sonra günceller ama TIKLANAN etkileşim (i) hiç
                    // onaylanmazsa kullanıcı "Bu etkileşim başarısız oldu" hatası görür.
                    await i.deferUpdate();
                    collector.stop('stand');
                } else {
                    await i.update({ embeds: [buildEmbed(true)], components: [row] });
                }
            } else if (i.customId === 'stand') {
                await i.deferUpdate();
                collector.stop('stand');
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'bust') return;

            // Krupiye kart çeker (17'ye kadar)
            while (calculateHand(dealerHand) < 17) {
                dealerHand.push(drawCard());
            }
            dealerScore = calculateHand(dealerHand);

            let statusMsg = '';
            let winAmount = 0;

            if (dealerScore > 21) {
                winAmount = bet * 2;
                statusMsg = '🎉 **Krupiye 21\'i aştı! Kazandın! (2x)**';
            } else if (playerScore > dealerScore) {
                winAmount = bet * 2;
                statusMsg = `🎉 **${playerScore} vs ${dealerScore} ile Krupiyeyi yendin! (2x)**`;
            } else if (playerScore === dealerScore) {
                winAmount = bet;
                statusMsg = '🤝 **Berabere! Bahsin iade edildi.**';
            } else {
                statusMsg = `😢 **Krupiye ${dealerScore} ile seni yendi! Kaybettin.**`;
            }

            if (winAmount > 0) {
                addBalance(interaction.guildId, interaction.user.id, winAmount);
            }

            const finalBal = getBalance(interaction.guildId, interaction.user.id);
            statusMsg += `\n💰 Kazanılan: \`${winAmount}\` 💰 | 💳 Güncel Bakiye: \`${finalBal}\` 💰`;

            await interaction.editReply({
                embeds: [buildEmbed(false, statusMsg)],
                components: []
            }).catch(() => {});
        });
    },
};
