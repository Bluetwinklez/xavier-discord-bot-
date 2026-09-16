const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setSettings } = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('otorol-ayarla')
        .setDescription('Sunucuya yeni katılan kullanıcılara otomatik verilecek rolü ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addRoleOption(option =>
            option.setName('rol')
                .setDescription('Yeni üyelere otomatik atanacak rol')
                .setRequired(true)
        ),
    async execute(interaction) {
        const role = interaction.options.getRole('rol');

        // Botun rolünün, atanacak rolden yüksek olup olmadığını kontrol et
        const botMember = await interaction.guild.members.fetchMe();
        if (role.position >= botMember.roles.highest.position) {
            return interaction.reply({
                content: `❌ **${role.name}** rolü benim en yüksek rolümden üstte veya eşit! Rol listesinde botumun rolünü bu rolün üstüne taşımalısınız.`,
                ephemeral: true
            });
        }

        setSettings(interaction.guildId, { autoRoleId: role.id });

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Oto-Rol Sistemi Aktif Edildi')
            .setDescription(`Sunucuya yeni katılan her üyeye otomatik olarak ${role} rolü verilecek.`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
