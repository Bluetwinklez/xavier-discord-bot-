const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { sendServerLog } = require('../../utils/serverLog');
const { requirePermission } = require('../../utils/permissionGuard');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duyuru')
        .setDescription('Belirtilen kanala başlıklı ve biçimli bir duyuru gönderir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option.setName('baslik')
                .setDescription('Duyurunun başlığı')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('mesaj')
                .setDescription('Duyuru metni')
                .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Duyurunun gönderileceği kanal (boş bırakılırsa bulunduğunuz kanala gönderilir)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('etiket')
                .setDescription('Duyuru ile birlikte etiketlenecek grup')
                .setRequired(false)
                .addChoices(
                    { name: 'Yok', value: 'none' },
                    { name: '@everyone (Herkes)', value: 'everyone' },
                    { name: '@here (Aktif Üyeler)', value: 'here' }
                )
        ),
    async execute(interaction) {
        if (!requirePermission(interaction, PermissionFlagsBits.ManageMessages)) return;

        const title = interaction.options.getString('baslik');
        const message = interaction.options.getString('mesaj');
        const targetChannel = interaction.options.getChannel('kanal') || interaction.channel;
        const mention = interaction.options.getString('etiket') || 'none';

        const perms = targetChannel.permissionsFor(interaction.client.user);
        if (!perms?.has(PermissionFlagsBits.SendMessages) || !perms?.has(PermissionFlagsBits.EmbedLinks)) {
            return interaction.reply({ content: `❌ ${targetChannel} kanalına mesaj/embed gönderme yetkim yok!`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📢 ${title}`)
            .setDescription(message)
            .setFooter({ text: `Duyuran: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        const content = mention === 'everyone' ? '@everyone' : mention === 'here' ? '@here' : undefined;

        try {
            await targetChannel.send({
                content,
                embeds: [embed],
                allowedMentions: { parse: mention === 'none' ? [] : [mention] }
            });

            await interaction.reply({ content: `✅ Duyuru ${targetChannel} kanalına gönderildi!`, ephemeral: true });

            sendServerLog(interaction.guild, {
                title: '📢 Duyuru Gönderildi',
                color: 0x5865F2,
                fields: [
                    { name: '📍 Kanal', value: `${targetChannel}`, inline: true },
                    { name: '🛡️ Yetkili', value: `${interaction.user.tag}`, inline: true },
                    { name: '📌 Başlık', value: title, inline: false }
                ]
            }).catch(() => {});
        } catch (error) {
            console.error('Duyuru gönderme hatası:', error);
            await interaction.reply({ content: '❌ Duyuru gönderilirken bir hata oluştu!', ephemeral: true });
        }
    },
};
