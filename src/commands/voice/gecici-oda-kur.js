const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { setSettings } = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gecici-oda-kur')
        .setDescription('Kullanıcıların kendi özel ses odalarını oluşturabileceği sistemi kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('kategori')
                .setDescription('Oda Oluştur kanalının ve geçici odaların açılacağı kategori (Opsiyonel)')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(false)
        ),
    async execute(interaction) {
        const guild = interaction.guild;
        let category = interaction.options.getChannel('kategori');

        await interaction.deferReply({ ephemeral: true });

        try {
            if (!category) {
                category = await guild.channels.create({
                    name: '🔊 │ ÖZEL ODALAR',
                    type: ChannelType.GuildCategory
                });
            }

            const hubChannel = await guild.channels.create({
                name: '➕ │ Oda Oluştur',
                type: ChannelType.GuildVoice,
                parent: category.id,
                userLimit: 1 // Tek kişi girip hemen odaya taşınsın
            });

            setSettings(guild.id, { tempVoiceHubId: hubChannel.id });

            const embed = new EmbedBuilder()
                .setColor(0x00FF88)
                .setTitle('✅ Geçici Oda Sistemi Başarıyla Kuruldu!')
                .setDescription(`Kullanıcılar ${hubChannel} kanalına bağlandığında otomatik olarak kendilerine özel oda açılacak ve o odada tam yönetici olacaklardır.`)
                .addFields(
                    { name: '📁 Kategori', value: `${category.name}`, inline: true },
                    { name: '🔊 Hub Kanalı', value: `${hubChannel}`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Geçici oda kurulum hatası:', error);
            await interaction.editReply(`❌ Kurulum yapılırken bir hata oluştu: ${error.message}`);
        }
    },
};
