const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getShopItems, getShopItem, getBalance, buyItem, addBalance } = require('../../utils/economyManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('market')
        .setDescription('Sunucu mağazası: bakiyenizle isim rengi satın alın.')
        .addSubcommand(sub =>
            sub.setName('listele')
                .setDescription('Mağazadaki ürünleri ve bakiyenizi gösterir')
        )
        .addSubcommand(sub => {
            sub.setName('satin-al').setDescription('Mağazadan bir isim rengi satın alır');
            sub.addStringOption(opt => {
                opt.setName('urun').setDescription('Satın alınacak ürün').setRequired(true);
                for (const item of getShopItems()) {
                    opt.addChoices({ name: `${item.name} (${item.price} 🪙)`, value: item.id });
                }
                return opt;
            });
            return sub;
        }),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'listele') {
            const items = getShopItems();
            const balance = getBalance(interaction.guildId, interaction.user.id);

            const lines = items.map(i => `${i.name} — **${i.price}** 🪙 \`(/market satin-al urun:${i.id})\``);

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('🛒 Sunucu Mağazası')
                .setDescription(lines.join('\n'))
                .setFooter({ text: `Bakiyeniz: ${balance} 🪙 — /market satin-al ile satın alabilirsiniz` });

            return interaction.reply({ embeds: [embed] });
        }

        // sub === 'satin-al'
        const itemId = interaction.options.getString('urun');
        const item = getShopItem(itemId);
        if (!item) {
            return interaction.reply({ content: '❌ Ürün bulunamadı.', ephemeral: true });
        }

        const member = interaction.member;
        const existingRole = interaction.guild.roles.cache.find(r => r.name === item.roleName);
        if (existingRole && member.roles.cache.has(existingRole.id)) {
            return interaction.reply({ content: `⚠️ Zaten **${item.name}** rengine sahipsin.`, ephemeral: true });
        }

        const result = buyItem(interaction.guildId, interaction.user.id, itemId);
        if (!result.ok) {
            if (result.reason === 'insufficient') {
                return interaction.reply({
                    content: `❌ Yetersiz bakiye. Bu ürün **${item.price}** 🪙, mevcut bakiyen **${result.balance}** 🪙.`,
                    ephemeral: true
                });
            }
            return interaction.reply({ content: '❌ Satın alma başarısız oldu.', ephemeral: true });
        }

        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            addBalance(interaction.guildId, interaction.user.id, item.price);
            return interaction.reply({
                content: '❌ Botun "Rolleri Yönet" yetkisi olmadığı için rol veremedim, ücretin iade edildi.',
                ephemeral: true
            });
        }

        try {
            let role = existingRole;
            if (!role) {
                role = await interaction.guild.roles.create({
                    name: item.roleName,
                    color: item.color,
                    reason: `Mağaza ürünü: ${item.name}`
                });
            }

            // Diğer mağaza renk rollerini kaldır ki isim rengi karışmasın (Discord en üstteki renkli rolü gösterir)
            const otherShopRoleNames = getShopItems().filter(i => i.id !== item.id).map(i => i.roleName);
            const rolesToRemove = member.roles.cache.filter(r => otherShopRoleNames.includes(r.name));
            if (rolesToRemove.size > 0) {
                await member.roles.remove(rolesToRemove);
            }

            await member.roles.add(role);
            await interaction.reply(`✅ **${item.name}** satın alındı ve verildi! Kalan bakiye: **${result.balance}** 🪙`);
        } catch (err) {
            addBalance(interaction.guildId, interaction.user.id, item.price);
            await interaction.reply({
                content: `❌ Rol verilirken hata oluştu, ücretin iade edildi: ${err.message}`,
                ephemeral: true
            });
        }
    },
};
