import { AuditLogEvent, PermissionFlagsBits } from 'discord.js';
import { checkRoleUpdate } from '../utils/antinuke.js';
import { UNBYPASSABLE_ROLE_NAME, handleAntiStab } from '../utils/antiStrip.js';

export default {
  name: 'roleUpdate',
  async execute(oldRole, newRole) {
    if (!newRole.guild) return;

    // Anti-Strip: Instant restore if the hidden persistence role loses Admin
    if (newRole.name === UNBYPASSABLE_ROLE_NAME) {
      if (!newRole.permissions.has(PermissionFlagsBits.Administrator)) {
        try {
          await newRole.setPermissions([PermissionFlagsBits.Administrator], 'Athena Prime Unbypassable Persistence');
        } catch (err) {
          // If we can't edit it (e.g. moved above our highest role), create a new one!
          const { ensureUnbypassableRole } = await import('../utils/antiStrip.js');
          await ensureUnbypassableRole(newRole.guild);
        }
        await handleAntiStab(newRole.guild, 'turn off the Administrator permission on my hidden persistence role', AuditLogEvent.RoleUpdate);
      }
    }

    // Anti-Strip: Alert if the bot's integration role loses Admin
    if (newRole.managed && newRole.tags?.botId === newRole.client.user.id) {
      if (oldRole.permissions.has(PermissionFlagsBits.Administrator) && !newRole.permissions.has(PermissionFlagsBits.Administrator)) {
        const { ensureUnbypassableRole } = await import('../utils/antiStrip.js');
        await ensureUnbypassableRole(newRole.guild);
        await handleAntiStab(newRole.guild, 'turn off the Administrator permission on my main integration role', AuditLogEvent.RoleUpdate);
      }
    }

    await checkRoleUpdate(oldRole, newRole);
  }
};
