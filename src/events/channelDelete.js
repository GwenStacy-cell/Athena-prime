import { AuditLogEvent, ChannelType } from 'discord.js';
import { checkAntiNuke } from '../utils/antinuke.js';
import { isBotOwnerSync } from '../utils/helpers.js';
import db from '../database.js';

export default {
  name: 'channelDelete',
  async execute(channel) {
    if (!channel.guild) return;

    // Run existing antinuke first
    await checkAntiNuke(channel.guild, 'Channel Deletion', AuditLogEvent.ChannelDelete, null, channel);

    // ==========================================
    // AUTO-RESTORE: Recreate if unauthorized
    // ==========================================

    // Skip if modification mode is active
    if (db.isModModeActive(channel.guild.id)) return;

    // Skip categories — only restore text/voice/announcement channels
    const restorableTypes = [
      ChannelType.GuildText,
      ChannelType.GuildVoice,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildStageVoice,
      ChannelType.GuildForum
    ];
    if (!restorableTypes.includes(channel.type)) return;

    // Fetch audit log to determine who deleted the channel
    try {
      await new Promise(r => setTimeout(r, 1000)); // brief wait for audit log
      const logs = await channel.guild.fetchAuditLogs({
        type:  AuditLogEvent.ChannelDelete,
        limit: 1
      }).catch(() => null);

      const entry    = logs?.entries?.first();
      const executor = entry?.executor;

      if (!executor) return; // can't determine — skip

      // Check if executor is authorized
      const isAuth =
        executor.id === channel.guild.client.user.id ||   // bot itself
        isBotOwnerSync(executor.id) ||                    // bot owner
        executor.id === channel.guild.ownerId ||           // server owner
        db.isExtraOwner(channel.guild.id, executor.id) || // extra owner
        db.isWhitelisted(channel.guild, executor.id);      // whitelisted

      if (isAuth) return; // authorized — don't restore

      // Unauthorized deletion — recreate the channel
      const guild = channel.guild;
      const bot   = guild.members.me;

      // Find parent category by name if available
      let parent = null;
      if (channel.parent) {
        parent = guild.channels.cache.find(c =>
          c.type === ChannelType.GuildCategory && c.name === channel.parent.name
        ) || null;
      }

      const newChannel = await guild.channels.create({
        name:             channel.name,
        type:             channel.type,
        topic:            channel.topic   || undefined,
        nsfw:             channel.nsfw    || false,
        bitrate:          channel.bitrate || undefined,
        userLimit:        channel.userLimit || undefined,
        rateLimitPerUser: channel.rateLimitPerUser || undefined,
        parent:           parent?.id || undefined,
        position:         channel.rawPosition,
        reason:           `Athena Prime — Auto-restore (unauthorized deletion by ${executor.tag})`
      }).catch(() => null);

      if (!newChannel) return;

      // Restore permission overwrites
      for (const [, ow] of channel.permissionOverwrites.cache) {
        await newChannel.permissionOverwrites.create(ow.id, {
          allow: ow.allow.bitfield,
          deny:  ow.deny.bitfield
        }, { reason: 'Athena Prime — Auto-restore permissions' }).catch(() => null);
      }

      // Log the restoration
      const config = db.getGuildConfig(guild.id);
      if (config.logChannelId) {
        const logCh = guild.channels.cache.get(config.logChannelId);
        if (logCh) {
          const { default: embed } = await import('../embed.js');
          await logCh.send({ embeds: [embed.warn(
            '🔄 Channel Auto-Restored',
            `An unauthorized channel deletion was detected and reversed.`,
            [
              { name: '📺 Channel',    value: `${newChannel} (\`${newChannel.name}\`)`, inline: true },
              { name: '❌ Deleted By', value: `${executor.tag} (\`${executor.id}\`)`,  inline: true },
              { name: '⚡ Action',     value: 'Channel recreated automatically',        inline: false }
            ]
          )] }).catch(() => null);
        }
      }
    } catch (err) {
      console.error('[AutoRestore:Channel]', err);
    }
  }
};
