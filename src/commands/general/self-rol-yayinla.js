const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getSettings } = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('self-rol-yayinla')
        .setDescription('Kendi kendine rol alma menüsünü bu kanala gönderir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(interaction) {
        const settings = getSettings(interaction.guildId);
        const selfRoles = settings.selfRoles || [];

        if (selfRoles.length === 0) {
            return interaction.reply({ content: '❌ Henüz hiç self-rol eklenmemiş. Önce `/self-rol-ekle` ile rol ekleyin.', ephemeral: true });
        }

        const validRoles = selfRoles.filter(r => interaction.guild.roles.cache.has(r.roleId));
        if (validRoles.length === 0) {
            return interaction.reply({ content: '❌ Eklenen roller artık sunucuda bulunmuyor.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎭 Rol Seçim Menüsü')
            .setDescription('Aşağıdaki menüden istediğin rolleri seçerek anında alabilir, tekrar seçerek çıkarabilirsin.')
            .setTimestamp();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('self_role_select')
            .setPlaceholder('Rol(ler) seç...')
            .setMinValues(0)
            .setMaxValues(validRoles.length)
            .addOptions(validRoles.map(r => {
                const role = interaction.guild.roles.cache.get(r.roleId);
                return { label: role.name, value: role.id, description: r.description };
            }));

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Rol seçim menüsü gönderildi!', ephemeral: true });
    },
};
