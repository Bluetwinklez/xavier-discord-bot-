const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

function getRulesEmbeds() {
    const bannerPath = path.join(__dirname, '../../assets/banner.jpg');
    let files = [];

    const headerEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎮 ELİTE GAMING TOPLULUĞUNA HOŞ GELDİNİZ! 🎮')
        .setDescription(
            'Burası rekabetçi oyuncuların, takım arkadaşı arayanların ve kaliteli muhabbet seven herkesin buluşma noktasıdır!\n\n' +
            'Sunucumuzda huzurlu, saygılı ve keyifli bir oyun atmosferi sağlamak amacıyla belirlenen kurallar aşağıda listelenmiştir. ' +
            'Sunucuda bulunan her üye bu kuralları okumuş ve kabul etmiş sayılır.'
        );

    if (fs.existsSync(bannerPath)) {
        files.push(new AttachmentBuilder(bannerPath, { name: 'banner.jpg' }));
        headerEmbed.setImage('attachment://banner.jpg');
    }

    const rulesEmbed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('📜 TOPLULUK VE OYUN KURALLARI')
        .addFields(
            {
                name: '1. 🤝 Saygı ve Hoşgörü',
                value: 'Din, dil, ırk, cinsiyet veya kişisel tercihlere yönelik hakaret, ayrımcılık ve nefret söylemi kesinlikle yasaktır.'
            },
            {
                name: '2. 🚫 Toksiklik ve Trollemek',
                value: 'Oyun kanallarında ve ses odalarında diğer oyuncuların oyun zevkini baltalayan toksik davranışlar, trolleme ve hakaretler ceza sebebidir.'
            },
            {
                name: '3. 📢 Reklam ve Tanıtım Yasağı',
                value: 'Yetkililerden izin alınmaksızın metin kanallarından veya DM (özel mesaj) üzerinden başka Discord sunucusu, YouTube kanalı vb. reklamı yapmak kalıcı yasaklanma (ban) sebebidir.'
            },
            {
                name: '4. 🔊 Ses Odaları Düzeni',
                value: 'Ses kanallarında kulak tırmalayıcı sesler çıkarmak, ses değiştirici programlarla rahatsızlık vermek ve mikrofon basmak yasaktır. Duo ve Squad odalarının limitlerine riayet ediniz.'
            },
            {
                name: '5. 🛡️ Yetkili Kararları',
                value: 'Yetkili ekibin kararlarına saygı gösteriniz. Bir sorun veya haksızlık olduğunu düşünüyorsanız `#🎫│destek-talebi` kanalından talep açınız.'
            }
        )
        .setFooter({ text: 'İyi oyunlar ve keyifli sohbetler dileriz!' })
        .setTimestamp();

    return { embeds: [headerEmbed, rulesEmbed], files };
}

module.exports = { getRulesEmbeds };
