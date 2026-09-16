// /ai-panel komutu ve interactionCreate.js'in paylaştığı ortak panel embed/component üreticisi
const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require('discord.js');
const { getSettings } = require('./database');
const { getPersona, getAllPersonas } = require('./aiPersonas');

function buildAiPanelEmbed(guild, settings) {
    const persona = getPersona(settings.aiPersona || 'gemini');
    const channelText = settings.aiChannelId ? `<#${settings.aiChannelId}>` : '*Ayarlanmadı (sadece @etiketleyerek çalışır)*';
    const roleText = settings.aiRoleId ? `<@&${settings.aiRoleId}>` : '*Ayarlanmadı (sadece Yöneticiler kullanabilir)*';
    const managerRoleText = settings.aiManagerRoleId ? `<@&${settings.aiManagerRoleId}>` : '*Ayarlanmadı (sadece gerçek Discord yetkisi olanlar/Yöneticiler yönetim eylemi yaptırabilir)*';

    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🧠 Yapay Zeka Kontrol Paneli')
        .setDescription(
            'Aşağıdaki menülerden yapay zekanın kişiliğini, sohbet kanalını, kullanım rolünü ve **yönetici rolünü** ayarlayabilirsiniz.\n\n' +
            '🔑 **Kullanım Rolü**: Bu role/Yöneticilere sahip olanlar AI ile sohbet edebilir.\n' +
            '🎖️ **AI Yönetici Rolü**: Bu role sahip olanlar, kendi Discord yetkisi olmasa bile AI\'ye ban/kick/kanal-rol yönetimi gibi komutlar verebilir. Bu role sahip OLMAYANLAR AI ile sadece sohbet eder ve normal bir üyenin yapabileceği şeyleri (müzik, zar, vs.) yaptırabilir.'
        )
        .addFields(
            { name: '🎭 Aktif Mod', value: `${persona.icon} ${persona.name}`, inline: true },
            { name: '💬 AI Kanalı', value: channelText, inline: true },
            { name: '🔑 Kullanım Rolü', value: roleText, inline: true },
            { name: '🎖️ AI Yönetici Rolü', value: managerRoleText, inline: false }
        )
        .setFooter({ text: `${guild.name} · Değişiklikler anında uygulanır`, iconURL: guild.iconURL({ dynamic: true }) || undefined })
        .setTimestamp();
}

function buildAiPanelComponents() {
    const personaSelect = new StringSelectMenuBuilder()
        .setCustomId('panel_ai_persona')
        .setPlaceholder('🎭 Yapay zeka modunu seç...')
        .addOptions(getAllPersonas().map(p => ({
            label: p.name,
            value: p.id,
            description: p.description.slice(0, 100),
            emoji: p.icon
        })));

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('panel_ai_channel')
        .setPlaceholder('💬 AI sohbet kanalını seç...')
        .addChannelTypes(ChannelType.GuildText);

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('panel_ai_role')
        .setPlaceholder('🔑 AI kullanım rolünü seç...');

    const managerRoleSelect = new RoleSelectMenuBuilder()
        .setCustomId('panel_ai_manager_role')
        .setPlaceholder('🎖️ AI Yönetici rolünü seç (mevcut bir rol)...');

    const resetRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('panel_ai_reset_channel').setLabel('Kanal Kısıtını Kaldır').setStyle(ButtonStyle.Secondary).setEmoji('🔓'),
        new ButtonBuilder().setCustomId('panel_ai_reset_role').setLabel('Kullanım Rolünü Kaldır').setStyle(ButtonStyle.Secondary).setEmoji('🔓'),
        new ButtonBuilder().setCustomId('panel_ai_reset_manager_role').setLabel('Yönetici Rolünü Kaldır').setStyle(ButtonStyle.Secondary).setEmoji('🔓'),
        new ButtonBuilder().setCustomId('panel_ai_create_manager_role').setLabel('Yönetici Rolü Oluştur').setStyle(ButtonStyle.Success).setEmoji('🎖️'),
        new ButtonBuilder().setCustomId('panel_ai_refresh').setLabel('Yenile').setStyle(ButtonStyle.Primary).setEmoji('🔄')
    );

    return [
        new ActionRowBuilder().addComponents(personaSelect),
        new ActionRowBuilder().addComponents(channelSelect),
        new ActionRowBuilder().addComponents(roleSelect),
        new ActionRowBuilder().addComponents(managerRoleSelect),
        resetRow
    ];
}

async function renderAiPanel(guild) {
    const settings = getSettings(guild.id);
    return {
        embeds: [buildAiPanelEmbed(guild, settings)],
        components: buildAiPanelComponents()
    };
}

module.exports = { buildAiPanelEmbed, buildAiPanelComponents, renderAiPanel };
