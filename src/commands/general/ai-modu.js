const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setSettings, getSettings } = require('../../utils/database');
const { AI_PERSONAS, getPersona } = require('../../utils/aiPersonas');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ai-modu')
        .setDescription('Yapay zekanın kişiliğini ve çalışma modunu değiştirir')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('mod')
                .setDescription('Geçmek istediğiniz yapay zeka modu')
                .setRequired(false)
                .addChoices(
                    { name: '✨ Google Gemini (Varsayılan - DeepMind)', value: 'gemini' },
                    { name: '💖 Flörtöz (Tatlı Dilli & Çapkın)', value: 'flirt' },
                    { name: '🧡 Anthropic Claude (Empatik & Detaylı)', value: 'claude' },
                    { name: '🟢 OpenAI ChatGPT (Hızlı & Pratik)', value: 'gpt' },
                    { name: '⚡ xAI Grok (Dobra & Esprili)', value: 'grok' },
                    { name: '🧠 DeepSeek (Mantık & Kod)', value: 'deepseek' },
                    { name: '🔍 Perplexity AI (Araştırmacı)', value: 'perplexity' },
                    { name: '💻 Cursor AI (Yazılım Mühendisi)', value: 'cursor' },
                    { name: '🌐 Alibaba Qwen (Küresel & Çok Dilli)', value: 'qwen' }
                )
        ),

    async execute(interaction) {
        const selected = interaction.options.getString('mod');
        const currentSettings = getSettings(interaction.guildId);

        if (!selected) {
            const current = getPersona(currentSettings.aiPersona || 'gemini');
            const embed = new EmbedBuilder()
                .setTitle('🤖 Aktif Yapay Zeka Modu')
                .setDescription(`Şu anda aktif mod: **${current.icon} ${current.name}** (\`${current.tag}\`)\n\n*${current.description}*`)
                .setColor(0x5865F2)
                .addFields(
                    Object.values(AI_PERSONAS).map(p => ({
                        name: `${p.icon} ${p.name}`,
                        value: p.description,
                        inline: true
                    }))
                )
                .setFooter({ text: 'Değiştirmek için: /ai-modu mod:<seçenek>' });

            return interaction.reply({ embeds: [embed] });
        }

        const newPersona = getPersona(selected);
        setSettings(interaction.guildId, { aiPersona: selected });

        const embed = new EmbedBuilder()
            .setTitle(`${newPersona.icon} Yapay Zeka Modu Değiştirildi!`)
            .setDescription(`Bot artık **${newPersona.name}** (\`${newPersona.tag}\`) kişiliği ve kurallarıyla çalışacak.\n\n> *${newPersona.description}*`)
            .setColor(0x57F287)
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
};
