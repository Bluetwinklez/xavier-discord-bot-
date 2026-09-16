const { Events, AuditLogEvent, EmbedBuilder } = require('discord.js');
const { getSettings } = require('../utils/database');
const logger = require('../utils/logger');

// Denetim Kaydı (Audit Log) Eylem Tanımları ve Türkçe Açıklamaları
const AUDIT_ACTIONS = {
    [AuditLogEvent.ChannelCreate]: {
        title: '📁 Kanal Oluşturuldu',
        color: 0x2ECC71,
        verb: 'kanalını oluşturdu',
        type: 'channel'
    },
    [AuditLogEvent.ChannelUpdate]: {
        title: '⚙️ Kanal Güncellendi',
        color: 0x3498DB,
        verb: 'kanalını güncelledi',
        type: 'channel'
    },
    [AuditLogEvent.ChannelDelete]: {
        title: '🗑️ Kanal Silindi',
        color: 0xE74C3C,
        verb: 'kanalını sildi',
        type: 'channel'
    },
    [AuditLogEvent.ChannelOverwriteCreate]: {
        title: '🔒 Kanal İzni Eklendi',
        color: 0x2ECC71,
        verb: 'kanalına özel izin ekledi',
        type: 'channel'
    },
    [AuditLogEvent.ChannelOverwriteUpdate]: {
        title: '🔒 Kanal İzni Güncellendi',
        color: 0x3498DB,
        verb: 'kanalının izinlerini güncelledi',
        type: 'channel'
    },
    [AuditLogEvent.ChannelOverwriteDelete]: {
        title: '🔓 Kanal İzni Kaldırıldı',
        color: 0xE74C3C,
        verb: 'kanalının özel izinlerini kaldırdı',
        type: 'channel'
    },
    [AuditLogEvent.MemberKick]: {
        title: '👢 Üye Atıldı (Kick)',
        color: 0xE67E22,
        verb: 'kullanıcısını sunucudan attı',
        type: 'member'
    },
    [AuditLogEvent.MemberPrune]: {
        title: '🧹 Üye Temizliği (Prune)',
        color: 0xE67E22,
        verb: 'inaktif üyeleri temizledi',
        type: 'general'
    },
    [AuditLogEvent.MemberBanAdd]: {
        title: '🔨 Üye Yasaklandı (Ban)',
        color: 0xED4245,
        verb: 'kullanıcısını yasakladı',
        type: 'member'
    },
    [AuditLogEvent.MemberBanRemove]: {
        title: '🕊️ Yasaklama Kaldırıldı (Unban)',
        color: 0x57F287,
        verb: 'için olan yasaklamayı kaldırdı',
        type: 'member'
    },
    [AuditLogEvent.MemberUpdate]: {
        title: '👤 Üye Güncellendi',
        color: 0x3498DB,
        verb: 'kullanıcısını güncelledi',
        type: 'member'
    },
    [AuditLogEvent.MemberRoleUpdate]: {
        title: '🎭 Üye Rolleri Güncellendi',
        color: 0x9B59B6,
        verb: 'kullanıcısının rollerini güncelledi',
        type: 'member'
    },
    [AuditLogEvent.MemberMove]: {
        title: '🔊 Ses Kanalı Taşıma',
        color: 0x3498DB,
        verb: 'kullanıcısını başka bir ses kanalına taşıdı',
        type: 'member'
    },
    [AuditLogEvent.MemberDisconnect]: {
        title: '🔇 Sesten Bağlantı Kesme',
        color: 0xE74C3C,
        verb: 'kullanıcısının ses bağlantısını kesti',
        type: 'member'
    },
    [AuditLogEvent.BotAdd]: {
        title: '🤖 Bot Eklendi',
        color: 0x5865F2,
        verb: 'botunu sunucuya ekledi',
        type: 'member'
    },
    [AuditLogEvent.RoleCreate]: {
        title: '🛡️ Rol Oluşturuldu',
        color: 0x2ECC71,
        verb: 'rolünü oluşturdu',
        type: 'role'
    },
    [AuditLogEvent.RoleUpdate]: {
        title: '⚙️ Rol Güncellendi',
        color: 0x3498DB,
        verb: 'rolünü güncelledi',
        type: 'role'
    },
    [AuditLogEvent.RoleDelete]: {
        title: '🗑️ Rol Silindi',
        color: 0xE74C3C,
        verb: 'rolünü sildi',
        type: 'role'
    },
    [AuditLogEvent.InviteCreate]: {
        title: '📨 Davet Linki Oluşturuldu',
        color: 0x2ECC71,
        verb: 'için davet linki oluşturdu',
        type: 'general'
    },
    [AuditLogEvent.InviteDelete]: {
        title: '❌ Davet Linki Silindi',
        color: 0xE74C3C,
        verb: 'davet linkini sildi',
        type: 'general'
    },
    [AuditLogEvent.WebhookCreate]: {
        title: '🔗 Webhook Oluşturuldu',
        color: 0x2ECC71,
        verb: 'webhook oluşturdu',
        type: 'general'
    },
    [AuditLogEvent.WebhookUpdate]: {
        title: '⚙️ Webhook Güncellendi',
        color: 0x3498DB,
        verb: 'webhook güncelledi',
        type: 'general'
    },
    [AuditLogEvent.WebhookDelete]: {
        title: '🗑️ Webhook Silindi',
        color: 0xE74C3C,
        verb: 'webhook sildi',
        type: 'general'
    },
    [AuditLogEvent.EmojiCreate]: {
        title: '😀 Emoji Eklendi',
        color: 0x2ECC71,
        verb: 'emojisini ekledi',
        type: 'general'
    },
    [AuditLogEvent.EmojiUpdate]: {
        title: '⚙️ Emoji Güncellendi',
        color: 0x3498DB,
        verb: 'emojisini güncelledi',
        type: 'general'
    },
    [AuditLogEvent.EmojiDelete]: {
        title: '🗑️ Emoji Silindi',
        color: 0xE74C3C,
        verb: 'emojisini sildi',
        type: 'general'
    },
    [AuditLogEvent.StickerCreate]: {
        title: '🎨 Çıkartma Eklendi',
        color: 0x2ECC71,
        verb: 'çıkartmasını ekledi',
        type: 'general'
    },
    [AuditLogEvent.StickerUpdate]: {
        title: '⚙️ Çıkartma Güncellendi',
        color: 0x3498DB,
        verb: 'çıkartmasını güncelledi',
        type: 'general'
    },
    [AuditLogEvent.StickerDelete]: {
        title: '🗑️ Çıkartma Silindi',
        color: 0xE74C3C,
        verb: 'çıkartmasını sildi',
        type: 'general'
    },
    [AuditLogEvent.MessageDelete]: {
        title: '🗑️ Mesaj Silindi (Yetkili Tarafından)',
        color: 0xE74C3C,
        verb: 'kullanıcısının mesajını sildi',
        type: 'message'
    },
    [AuditLogEvent.MessageBulkDelete]: {
        title: '🧹 Toplu Mesaj Temizlendi',
        color: 0xE74C3C,
        verb: 'kanalında toplu mesaj sildi',
        type: 'channel'
    },
    [AuditLogEvent.MessagePin]: {
        title: '📌 Mesaj Sabitlendi',
        color: 0x3498DB,
        verb: 'mesajı sabitledi',
        type: 'message'
    },
    [AuditLogEvent.MessageUnpin]: {
        title: '📌 Mesaj Sabitlemesi Kaldırıldı',
        color: 0x95A5A6,
        verb: 'mesajın sabitlemesini kaldırdı',
        type: 'message'
    },
    [AuditLogEvent.ThreadCreate]: {
        title: '🧵 Alt Başlık (Thread) Oluşturuldu',
        color: 0x2ECC71,
        verb: 'alt başlığını oluşturdu',
        type: 'channel'
    },
    [AuditLogEvent.ThreadUpdate]: {
        title: '⚙️ Alt Başlık Güncellendi',
        color: 0x3498DB,
        verb: 'alt başlığını güncelledi',
        type: 'channel'
    },
    [AuditLogEvent.ThreadDelete]: {
        title: '🗑️ Alt Başlık Silindi',
        color: 0xE74C3C,
        verb: 'alt başlığını sildi',
        type: 'channel'
    },
    [AuditLogEvent.AutoModerationRuleCreate]: {
        title: '🛡️ Otomod Kuralı Eklendi',
        color: 0x2ECC71,
        verb: 'otomod kuralı ekledi',
        type: 'general'
    },
    [AuditLogEvent.AutoModerationRuleUpdate]: {
        title: '⚙️ Otomod Kuralı Güncellendi',
        color: 0x3498DB,
        verb: 'otomod kuralını güncelledi',
        type: 'general'
    },
    [AuditLogEvent.AutoModerationRuleDelete]: {
        title: '🗑️ Otomod Kuralı Silindi',
        color: 0xE74C3C,
        verb: 'otomod kuralını sildi',
        type: 'general'
    },
    [AuditLogEvent.AutoModerationBlockMessage]: {
        title: '🚫 Otomod Mesaj Engelledi',
        color: 0xED4245,
        verb: 'kural ihlali mesajını engelledi',
        type: 'general'
    },
    [AuditLogEvent.GuildUpdate]: {
        title: '🏰 Sunucu Ayarları Güncellendi',
        color: 0xF1C40F,
        verb: 'sunucu ayarlarını güncelledi',
        type: 'general'
    }
};

function formatTarget(target, targetId, type) {
    if (!target && !targetId) return 'Sunucu / Genel';
    if (type === 'channel') {
        return `<#${targetId}> (\`${target?.name || targetId}\`)`;
    }
    if (type === 'member') {
        return `<@${targetId}> (\`${target?.tag || target?.username || targetId}\`)`;
    }
    if (type === 'role') {
        return `<@&${targetId}> (\`${target?.name || targetId}\`)`;
    }
    return target?.name ? `**${target.name}** (\`${targetId}\`)` : `\`${targetId}\``;
}

module.exports = {
    name: Events.GuildAuditLogEntryCreate,
    async execute(entry, guild) {
        if (!guild) return;

        const settings = getSettings(guild.id);
        if (!settings.logChannelId) return;

        const logChannel = guild.channels.cache.get(settings.logChannelId);
        if (!logChannel) return;

        const actionInfo = AUDIT_ACTIONS[entry.action] || {
            title: '📜 Denetim Kaydı Olayı',
            color: 0x5865F2,
            verb: 'eylemini gerçekleştirdi',
            type: 'general'
        };

        const executor = entry.executor;
        const executorTag = executor ? executor.tag : 'Bilinmeyen Yetkili';
        const executorMention = executor ? `<@${executor.id}>` : executorTag;
        const executorAvatar = executor ? executor.displayAvatarURL({ dynamic: true }) : null;

        const targetDisplay = formatTarget(entry.target, entry.targetId, actionInfo.type);

        // Denetim kaydı formatında başlık açıklaması:
        // Örn: "doflerim, kazutorakun7 için olan yasaklamayı kaldırdı"
        const headerText = `${executorMention} (\`${executorTag}\`), ${targetDisplay} ${actionInfo.verb}.`;

        const embed = new EmbedBuilder()
            .setColor(actionInfo.color)
            .setTitle(actionInfo.title)
            .setDescription(headerText)
            .setTimestamp(entry.createdAt || new Date());

        if (executorAvatar) {
            embed.setAuthor({ name: `${executorTag} (Denetim Kaydı)`, iconURL: executorAvatar });
        }

        const fields = [
            { name: '👤 Yetkili (Yapan)', value: `${executorMention} (\`${executor?.id || '?'}\`)`, inline: true },
            { name: '🎯 Hedef', value: targetDisplay, inline: true }
        ];

        // 1. Ekstra Detaylar (MemberMove, BulkDelete vb.)
        if (entry.extra) {
            if (entry.extra.channel) {
                fields.push({ name: '📍 İlgili Kanal', value: `<#${entry.extra.channel.id}> (\`${entry.extra.channel.id}\`)`, inline: true });
            }
            if (entry.extra.count) {
                fields.push({ name: '🔢 Miktar', value: `${entry.extra.count} adet`, inline: true });
            }
        }

        // 2. Rol Güncellemeleri ($add / $remove)
        if (entry.action === AuditLogEvent.MemberRoleUpdate && entry.changes) {
            const roleChanges = [];
            for (const change of entry.changes) {
                if (change.key === '$add' && Array.isArray(change.new)) {
                    const added = change.new.map(r => `<@&${r.id}>`).join(', ');
                    if (added) roleChanges.push(`➕ **Eklenen:** ${added}`);
                }
                if (change.key === '$remove' && Array.isArray(change.new)) {
                    const removed = change.new.map(r => `<@&${r.id}>`).join(', ');
                    if (removed) roleChanges.push(`➖ **Kaldırılan:** ${removed}`);
                }
            }
            if (roleChanges.length > 0) {
                fields.push({ name: '🎭 Değişen Roller', value: roleChanges.join('\n'), inline: false });
            }
        } else if (entry.changes && entry.changes.length > 0) {
            // Diğer değişiklikler (isim, takma ad, kural vb.)
            const changeList = [];
            for (const change of entry.changes) {
                if (change.key === 'nick') {
                    changeList.push(`**Takma Ad:** \`${change.old || '(Yok)'}\` ➔ \`${change.new || '(Yok)'}\``);
                } else if (change.key === 'name') {
                    changeList.push(`**İsim:** \`${change.old || '?'}\` ➔ \`${change.new || '?'}\``);
                } else if (change.key === 'topic') {
                    changeList.push(`**Açıklama/Konu:** Değiştirildi`);
                } else if (change.key === 'communication_disabled_until') {
                    if (change.new) {
                        const unixTime = Math.floor(new Date(change.new).getTime() / 1000);
                        changeList.push(`**Susturma (Timeout):** <t:${unixTime}:F> (<t:${unixTime}:R>) kadar`);
                    } else {
                        changeList.push(`**Susturma (Timeout):** Kaldırıldı`);
                    }
                } else if (change.key === 'mute' || change.key === 'deaf') {
                    changeList.push(`**${change.key === 'mute' ? 'Susturma' : 'Sağırlaştırma'}:** \`${change.new ? 'Aktif' : 'Kapatıldı'}\``);
                }
            }
            if (changeList.length > 0) {
                fields.push({ name: '📝 Değişiklik Detayları', value: changeList.join('\n'), inline: false });
            }
        }

        // 3. Sebep (Varsa)
        if (entry.reason) {
            fields.push({ name: '💬 Belirtilen Sebep', value: `*${entry.reason}*`, inline: false });
        }

        embed.addFields(fields);
        embed.setFooter({ text: `Eylem ID: ${entry.id} • ${guild.name}` });

        try {
            await logChannel.send({ embeds: [embed] });
        } catch (err) {
            logger.error(`[guildAuditLogEntryCreate] Log kanalına yazılamadı (guild: ${guild.id}):`, err.message);
        }
    }
};
