const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getSettings, setSettings } = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('self-rol-ekle')
        .setDescription('Üyelerin kendi kendine alabileceği rol listesine bir rol ekler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addRoleOption(option =>
            option.setName('rol')
                .setDescription('Listeye eklenecek rol')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('aciklama')
                .setDescription('Rolün kısa açıklaması (menüde görünür)')
                .setRequired(false)
        ),
    async execute(interaction) {
        const role = interaction.options.getRole('rol');
        const description = interaction.options.getString('aciklama') || 'Kendi kendine alınabilir rol';

        // Güvenlik: bu rol herhangi bir üye tarafından kendi kendine, hiçbir onay olmadan
        // alınabilecek — botun/entegrasyonun yönettiği bir rol (managed) veya Yönetici/Sunucuyu
        // Yönet/Rolleri Yönet/Banla/At gibi tehlikeli bir izin taşıyan rol asla listeye girmemeli,
        // aksi halde herhangi bir üye kendine ayrıcalık yükseltebilir (privilege escalation).
        if (role.managed) {
            return interaction.reply({ content: '❌ Bu rol bir bot/entegrasyon tarafından yönetiliyor, self-rol olarak eklenemez.', ephemeral: true });
        }
        const dangerousPerms = [
            PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild,
            PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageWebhooks, PermissionFlagsBits.BanMembers,
            PermissionFlagsBits.KickMembers, PermissionFlagsBits.ModerateMembers
        ];
        if (dangerousPerms.some(p => role.permissions.has(p))) {
            return interaction.reply({ content: '❌ Bu rol tehlikeli bir yetki taşıyor (Yönetici/Sunucuyu Yönet/Rolleri Yönet vb.), self-rol olarak eklenemez.', ephemeral: true });
        }
        if (!role.editable) {
            return interaction.reply({ content: '❌ Bu rol benim rolümden yüksek veya eşit olduğu için yönetemiyorum, self-rol olarak eklenemez.', ephemeral: true });
        }

        const settings = getSettings(interaction.guildId);
        const selfRoles = (settings.selfRoles || []).filter(r => r.roleId !== role.id);
        selfRoles.push({ roleId: role.id, description: description.slice(0, 100) });

        if (selfRoles.length > 25) {
            return interaction.reply({ content: '❌ En fazla 25 self-rol eklenebilir (Discord select menu sınırı).', ephemeral: true });
        }

        setSettings(interaction.guildId, { selfRoles });

        await interaction.reply(`✅ **${role.name}** self-rol listesine eklendi. (Toplam: ${selfRoles.length})\nMenüyü yayınlamak için \`/self-rol-yayinla\` komutunu kullan.`);
    },
};
