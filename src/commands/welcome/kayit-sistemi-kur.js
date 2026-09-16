const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { setSettings } = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kayit-sistemi-kur')
        .setDescription('Yeni üyeler için hoş geldin odası + butonlu kayıt sistemini kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Hoş geldin/kayıt kanalı (boş bırakılırsa otomatik oluşturulur)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addRoleOption(option =>
            option.setName('kayitsiz-rol')
                .setDescription('Yeni üyelere verilecek geçici rol (boş bırakılırsa otomatik oluşturulur)')
                .setRequired(false)
        )
        .addRoleOption(option =>
            option.setName('kayitli-rol')
                .setDescription('Kayıt tamamlanınca verilecek rol (boş bırakılırsa otomatik oluşturulur)')
                .setRequired(false)
        ),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;

        try {
            let channel = interaction.options.getChannel('kanal');
            if (!channel) {
                channel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.toLowerCase().includes('hos-geldin'));
            }
            if (!channel) {
                channel = await guild.channels.create({
                    name: '👋│hos-geldin',
                    type: ChannelType.GuildText,
                    permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.SendMessages] }]
                });
            }

            let unregRole = interaction.options.getRole('kayitsiz-rol');
            if (!unregRole) {
                unregRole = guild.roles.cache.find(r => r.name === '🔒 Kayıtsız')
                    || await guild.roles.create({ name: '🔒 Kayıtsız', color: 0x99AAB5, reason: 'Kayıt sistemi kurulumu' });
            }

            let regRole = interaction.options.getRole('kayitli-rol');
            if (!regRole) {
                regRole = guild.roles.cache.find(r => r.name === '✅ Kayıtlı Üye')
                    || await guild.roles.create({ name: '✅ Kayıtlı Üye', color: 0x2ECC71, hoist: true, reason: 'Kayıt sistemi kurulumu' });
            }

            setSettings(guild.id, {
                welcomeChannelId: channel.id,
                registrationEnabled: true,
                unregisteredRoleId: unregRole.id,
                registeredRoleId: regRole.id
            });

            const embed = new EmbedBuilder()
                .setColor(0x00FF88)
                .setTitle('✅ Kayıt Sistemi Kuruldu!')
                .setDescription(`Artık yeni katılan üyeler önce ${unregRole} rolünü alacak, ${channel} kanalına düşen **"📝 Kayıt Ol"** butonuna basınca ${regRole} rolüne yükseltilecek.`)
                .addFields(
                    { name: '📍 Kanal', value: `${channel}`, inline: true },
                    { name: '🔒 Kayıtsız Rol', value: `${unregRole}`, inline: true },
                    { name: '✅ Kayıtlı Rol', value: `${regRole}`, inline: true }
                )
                .setFooter({ text: '⚠️ Botun rolü, bu iki rolden daha yukarıda olmalı — yoksa rol veremez.' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Kayıt sistemi kurulum hatası:', error);
            await interaction.editReply('❌ Kayıt sistemi kurulurken bir hata oluştu. Botun `Rolleri Yönet` ve `Kanalları Yönet` yetkisine sahip olduğundan emin olun.');
        }
    },
};
