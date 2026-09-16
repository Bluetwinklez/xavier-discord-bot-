const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setSettings, getSettings } = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ai-rol-ayarla')
        .setDescription('Yapay zekayı (AI) kullanabilmesi için gerekli olan özel rolü ayarlar veya sıfırlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option =>
            option.setName('rol')
                .setDescription('Yapay zekayı kullanma izni verilecek rol (Boş bırakırsanız sadece Yöneticiler kullanabilir)')
                .setRequired(false)
        ),
    async execute(interaction) {
        const targetRole = interaction.options.getRole('rol');

        if (!targetRole) {
            setSettings(interaction.guildId, { aiRoleId: null });
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🔒 Yapay Zeka Rolü Sıfırlandı')
                .setDescription('Özel AI rolü kaldırıldı. Artık yapay zekayı sadece **Yöneticiler (Administrator)** kullanabilir.')
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        setSettings(interaction.guildId, { aiRoleId: targetRole.id });

        const embed = new EmbedBuilder()
            .setColor(0x00FF88)
            .setTitle('✅ Yapay Zeka Kullanım Rolü Ayarlandı')
            .setDescription(`Artık yapay zeka botu ile sohbet etmek ve komut vermek için **${targetRole}** rolüne veya **Yönetici** yetkisine sahip olmak gerekecektir.`)
            .addFields(
                { name: '🎭 Yetkili Rol', value: `${targetRole} (\`${targetRole.id}\`)`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
