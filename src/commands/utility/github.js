const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('github')
        .setDescription('Bir GitHub deposunun (repo) yıldızlarını, dilini ve detaylarını görüntüler.')
        .addStringOption(opt =>
            opt.setName('repo')
                .setDescription('Depo adı (örn: facebook/react veya discordjs/discord.js)')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        let repoQuery = interaction.options.getString('repo').trim();
        // Eğer tam URL girildiyse temizle
        repoQuery = repoQuery.replace('https://github.com/', '').replace(/\/+$/, '');

        try {
            const res = await fetch(`https://api.github.com/repos/${repoQuery}`, {
                headers: { 'User-Agent': 'Discord-Bot' }
            });

            if (res.status === 404) {
                return interaction.editReply(`❌ **${repoQuery}** adında bir GitHub deposu bulunamadı.`);
            }

            if (!res.ok) {
                return interaction.editReply('❌ GitHub API\'sine bağlanırken bir sorun oluştu.');
            }

            const data = await res.json();

            const embed = new EmbedBuilder()
                .setColor(0x24292E)
                .setTitle(`🐙 ${data.full_name}`)
                .setURL(data.html_url)
                .setDescription(data.description || '*Açıklama belirtilmemiş.*')
                .setThumbnail(data.owner?.avatar_url)
                .addFields(
                    { name: '⭐ Yıldızlar', value: `\`${data.stargazers_count.toLocaleString()}\``, inline: true },
                    { name: '🍴 Çatallar (Fork)', value: `\`${data.forks_count.toLocaleString()}\``, inline: true },
                    { name: '🐛 Açık Sorunlar', value: `\`${data.open_issues_count.toLocaleString()}\``, inline: true },
                    { name: '💻 Ana Dil', value: data.language || 'Belirtilmemiş', inline: true },
                    { name: '📜 Lisans', value: data.license ? data.license.spdx_id || data.license.name : 'Yok', inline: true },
                    { name: '🕒 Son Güncelleme', value: `<t:${Math.floor(new Date(data.updated_at).getTime() / 1000)}:R>`, inline: true }
                )
                .setFooter({ text: `GitHub Repository Viewer • İsteyen: ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('github hatası:', err);
            await interaction.editReply('❌ Bir hata oluştu: ' + err.message);
        }
    },
};
