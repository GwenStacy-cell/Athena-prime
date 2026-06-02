import { AuditLogEvent } from 'discord.js';
import { checkAntiNuke } from '../utils/antinuke.js';
import { isBotOwnerSync } from '../utils/helpers.js';
import db from '../database.js';

export default {
  name: 'roleDelete',
  async execute(role) {
    if (!role.guild) return;

    // Run existing antinuke first
    await checkAntiNuke(role.guild, 'Role Deletion', AuditLogEvent.RoleDelete, null, role);

    // ==========================================
    // AUTO-RESTORE: Recreate if unauthorized
    // ==========================================

    // Skip if modification mode is active
    if (db.isModModeActive(role.guild.id)) return;

    // Skip managed/integration roles (bots, boosts) — can't recreate those
    if (role.managed) return;

    try {
      await new Promise(r => setTimeout(r, 1000)); // brief wait for audit log

      const logs = await role.guild.fetchAuditLogs({
        type:  AuditLogEvent.RoleDelete,
        limit: 1
      }).catch(() => null);

      const entry    = logs?.entries?.first();
      const executor = entry?.executor;

      if (!executor) return;

      // Check if executor is authorized
      const isAuth =
        executor.id === role.guild.client.user.id ||      // bot itself
        isBotOwnerSync(executor.id) ||                    // bot owner
        executor.id === role.guild.ownerId ||              // server owner
        db.isExtraOwner(role.guild.id, executor.id) ||    // extra owner
        db.isWhitelisted(role.guild, executor.id);         // whitelisted

      if (isAuth) return; // authorized — don't restore

      // Unauthorized deletion — recreate role
      const guild = role.guild;

      const newRole = await guild.roles.create({
        name:        role.name,
        color:       role.color,
        hoist:       role.hoist,
        mentionable: role.mentionable,
        permissions: role.permissions,
        reason:      `Athena Prime — Auto-restore (unauthorized deletion by ${executor.tag})`
      }).catch(() => null);

      if (!newRole) return;

      // Log the restoration
      const config = db.getGuildConfig(guild.id);
      if (config.logChannelId) {
        const logCh = guild.channels.cache.get(config.logChannelId);
        if (logCh) {
          const { default: embed } = await import('../embed.js');
          await logCh.send({ embeds: [embed.warn(
            '🔄 Role Auto-Restored',
            `An unauthorized role deletion was detected and reversed.`,
            [
              { name: '🎭 Role',       value: `${newRole} (\`${newRole.name}\`)`,    inline: true },
              { name: '❌ Deleted By', value: `${executor.tag} (\`${executor.id}\`)`, inline: true },
              { name: '⚡ Action',     value: 'Role recreated automatically',          inline: false }
            ]
          )] }).catch(() => null);
        }
      }
    } catch (err) {
      console.error('[AutoRestore:Role]', err);
    }
  }
};
