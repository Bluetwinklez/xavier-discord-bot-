const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { executeAction } = require('../../utils/aiActionExecutor');
const { callAIProviders } = require('../../utils/aiManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ai-araclar')
        .setDescription('Gelişmiş Yapay Zeka (AI) araç kutusu, mülakat, analiz ve eğlence komutları.')
        .addSubcommand(sub =>
            sub.setName('ozet')
                .setDescription('Kanalda konuşulan son mesajları yapay zeka ile özetler.')
                .addIntegerOption(opt =>
                    opt.setName('mesaj_sayisi')
                        .setDescription('Özetlenecek mesaj sayısı (5 - 50 arası, varsayılan 25)')
                        .setMinValue(5)
                        .setMaxValue(50)
                )
        )
        .addSubcommand(sub =>
            sub.setName('kod')
                .setDescription('Yazdığınız kodu inceler, hataları bulur ve düzeltilmiş halini sunar.')
                .addStringOption(opt =>
                    opt.setName('kod_metni')
                        .setDescription('İncelenecek kod parçasını girin')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('mulakat')
                .setDescription('Yazılımcılar için teknik mülakat simülatörü (Junior/Mid/Senior soruları).')
                .addStringOption(opt =>
                    opt.setName('alan')
                        .setDescription('Uzmanlık alanı')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Frontend (React / JavaScript)', value: 'Frontend (React/JS/CSS)' },
                            { name: 'Backend (Node.js / Express / APIs)', value: 'Backend (Node.js/APIs/Database)' },
                            { name: 'Python & Veri Bilimi', value: 'Python (OOP/Data Structures)' },
                            { name: 'DevOps & Bulut (Docker / CI-CD)', value: 'DevOps (Docker/Linux/CI-CD)' },
                            { name: 'Siber Güvenlik & Network', value: 'Siber Güvenlik (OWASP/Web Security)' }
                        )
                )
                .addStringOption(opt =>
                    opt.setName('seviye')
                        .setDescription('Deneyim seviyesi')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Junior (Başlangıç / Stajyer)', value: 'Junior' },
                            { name: 'Mid-Level (Orta Düzey)', value: 'Mid-Level' },
                            { name: 'Senior (Kıdemli Mimar)', value: 'Senior' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('analiz')
                .setDescription('Sunucunun aktifliğini, büyümesini ve sağlık skorunu (100 üzerinden) puanlar.')
        )
        .addSubcommand(sub =>
            sub.setName('burc')
                .setDescription('Seçtiğiniz burç için günlük astrolojik yorum ve şans tüyoları.')
                .addStringOption(opt =>
                    opt.setName('burc_adi')
                        .setDescription('Burcunuzu seçin')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Koç', value: 'koç' },
                            { name: 'Boğa', value: 'boğa' },
                            { name: 'İkizler', value: 'ikizler' },
                            { name: 'Yengeç', value: 'yengeç' },
                            { name: 'Aslan', value: 'aslan' },
                            { name: 'Başak', value: 'başak' },
                            { name: 'Terazi', value: 'terazi' },
                            { name: 'Akrep', value: 'akrep' },
                            { name: 'Yay', value: 'yay' },
                            { name: 'Oğlak', value: 'oğlak' },
                            { name: 'Kova', value: 'kova' },
                            { name: 'Balık', value: 'balık' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('cevir')
                .setDescription('İstediğiniz metni hedef dünya diline çevirir.')
                .addStringOption(opt =>
                    opt.setName('dil')
                        .setDescription('Hedef dil (örn: İngilizce, Almanca, Rusça, Japonca)')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('metin')
                        .setDescription('Çevrilmesini istediğiniz metin')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('roast')
                .setDescription('Bir kullanıcıyı tatlı-sert, esprili ve zekice roastlar.')
                .addUserOption(opt =>
                    opt.setName('kullanici')
                        .setDescription('Roastlanacak kullanıcıyı seçin')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('iltifat')
                .setDescription('Bir kullanıcıya samimi, moral veren güzel bir söz söyler.')
                .addUserOption(opt =>
                    opt.setName('kullanici')
                        .setDescription('İltifat edilecek kullanıcıyı seçin')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('soz-yaz')
                .setDescription('Belirttiğiniz konu hakkında ritmik ve kafiyeli rap veya şiir sözü yazar.')
                .addStringOption(opt =>
                    opt.setName('konu')
                        .setDescription('Şarkı/şiir konusu (örn: Gece kod yazmak, dostluk)')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('tarz')
                        .setDescription('Tarzı seçin')
                        .addChoices(
                            { name: 'Rap Şarkı Sözü', value: 'rap' },
                            { name: 'Şiir', value: 'şiir' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('trivia')
                .setDescription('Yazılım, oyun ve genel kültür odaklı 4 şıklı bilgi yarışması sorusu sorar.')
                .addStringOption(opt =>
                    opt.setName('konu')
                        .setDescription('Soru konusu (opsiyonel)')
                )
        )
        .addSubcommand(sub =>
            sub.setName('ortam-modu')
                .setDescription('Kanaldaki son sohbetlerin enerjisini ve ruh halini ölçer.')
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();
        const context = {
            guild: interaction.guild,
            channel: interaction.channel,
            member: interaction.member,
            client: interaction.client
        };

        try {
            let result = null;

            if (subcommand === 'mulakat') {
                const area = interaction.options.getString('alan');
                const level = interaction.options.getString('seviye');

                const prompt = `Sen büyük bir teknoloji şirketinde (Google/Amazon/Meta düzeyinde) kıdemli teknik mülakatçısın.
Alan: ${area}
Aday Seviyesi: ${level}

Adaya sorulmak üzere:
1. Gerçekçi, düşündürücü bir teknik mülakat sorusu veya kod senaryosu hazırla.
2. Adayın bu soruda neyi bilmesi gerektiğini kısaca (ipucu olarak) belirt.
3. Bir sonraki adımda adayın cevabını beklediğini söyle.
Türkçe, profesyonel ve teşvik edici bir dille yaz.`;

                const question = await callAIProviders([
                    { role: 'system', content: 'Sen üst düzey bir teknik mülakat uzmanısın.' },
                    { role: 'user', content: prompt }
                ]);

                const embed = new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setTitle(`👔 Teknik Mülakat Simülasyonu: ${area}`)
                    .setDescription(`**Seviye:** \`${level}\`\n\n${question || 'Soru oluşturulamadı.'}\n\n*Cevabınızı bu kanala yazarak AI ile mülakata devam edebilirsiniz!*`)
                    .setFooter({ text: `Aday: ${interaction.user.tag}` })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            if (subcommand === 'analiz') {
                const guild = interaction.guild;
                const members = guild.memberCount;
                const channels = guild.channels.cache.size;
                const roles = guild.roles.cache.size;
                const boostCount = guild.premiumSubscriptionCount || 0;

                const prompt = `Aşağıdaki Discord sunucusu istatistiklerine bakarak sunucuya 0-100 arasında bir 'Sunucu Sağlık & Canlılık Skoru' ver.
Sunucu Adı: ${guild.name}
Üye Sayısı: ${members}
Kanal Sayısı: ${channels}
Rol Sayısı: ${roles}
Boost Sayısı: ${boostCount}

Lütfen:
1. 0-100 arası Sağlık Puanı (örn: 85/100)
2. Güçlü Yönler (2 madde)
3. Geliştirilebilecek Yönler (2 madde)
4. Sunucu Yöneticilerine 2 Özel Büyüme Tavsiyesi
Türkçe, motive edici ve analiz raporu formatında yaz.`;

                const report = await callAIProviders([
                    { role: 'system', content: 'Sen topluluk yöneticisi ve sunucu analisti asistansın.' },
                    { role: 'user', content: prompt }
                ]);

                const embed = new EmbedBuilder()
                    .setColor(0x00FF88)
                    .setTitle(`📊 ${guild.name} Sunucu Sağlık & Analiz Raporu`)
                    .setThumbnail(guild.iconURL({ dynamic: true }))
                    .setDescription(report || 'Analiz raporu oluşturulamadı.')
                    .setFooter({ text: 'Yapay Zeka Topluluk Analisti' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            if (subcommand === 'ozet') {
                const count = interaction.options.getInteger('mesaj_sayisi') || 25;
                result = await executeAction('summarize_chat', { count }, context);
            } else if (subcommand === 'kod') {
                const code = interaction.options.getString('kod_metni');
                result = await executeAction('code_review', { code }, context);
            } else if (subcommand === 'burc') {
                const sign = interaction.options.getString('burc_adi');
                result = await executeAction('daily_horoscope', { sign }, context);
            } else if (subcommand === 'cevir') {
                const language = interaction.options.getString('dil');
                const text = interaction.options.getString('metin');
                result = await executeAction('translate_text', { target_language: language, text }, context);
            } else if (subcommand === 'roast') {
                const targetUser = interaction.options.getUser('kullanici');
                result = await executeAction('roast_user', { user: targetUser ? targetUser.displayName : '' }, context);
            } else if (subcommand === 'iltifat') {
                const targetUser = interaction.options.getUser('kullanici');
                result = await executeAction('praise_user', { user: targetUser ? targetUser.displayName : '' }, context);
            } else if (subcommand === 'soz-yaz') {
                const topic = interaction.options.getString('konu');
                const style = interaction.options.getString('tarz') || 'rap';
                result = await executeAction('write_lyrics', { topic, style }, context);
            } else if (subcommand === 'trivia') {
                const topic = interaction.options.getString('konu') || 'yazılım ve genel kültür';
                result = await executeAction('trivia_quiz', { topic }, context);
            } else if (subcommand === 'ortam-modu') {
                result = await executeAction('server_mood', {}, context);
            }

            if (!result) {
                return interaction.editReply('❌ Bir yanıt üretilemedi, lütfen tekrar deneyin.');
            }

            if (result.length > 2000) {
                return interaction.editReply(result.slice(0, 1990) + '...');
            }

            await interaction.editReply(result);
        } catch (err) {
            console.error('ai-araclar hatası:', err);
            await interaction.editReply('❌ Komut çalıştırılırken bir hata oluştu: ' + (err.message || err));
        }
    },
};
