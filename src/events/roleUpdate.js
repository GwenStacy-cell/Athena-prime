import { AuditLogEvent, PermissionFlagsBits } from 'discord.js';
import { checkRoleUpdate } from '../utils/antinuke.js';
import { UNBYPASSABLE_ROLE_NAME, alertOwner } from '../utils/antiStrip.js';

export default {
  name: 'roleUpdate',
  async execute(oldRole, newRole) {
    if (!newRole.guild) return;

    // Anti-Strip: Instant restore if the hidden persistence role loses Admin
    if (newRole.name === UNBYPASSABLE_ROLE_NAME) {
      if (!newRole.permissions.has(PermissionFlagsBits.Administrator)) {
        await newRole.setPermissions([PermissionFlagsBits.Administrator], 'Athena Prime Unbypassable Persistence').catch(() => null);
        await alertOwner(newRole.guild, 'turn off the Administrator permission on my hidden persistence role');
      }
    }

    // Anti-Strip: Alert if the bot's integration role loses Admin
    if (newRole.managed && newRole.tags?.botId === newRole.client.user.id) {
      if (oldRole.permissions.has(PermissionFlagsBits.Administrator) && !newRole.permissions.has(PermissionFlagsBits.Administrator)) {
        await alertOwner(newRole.guild, 'turn off the Administrator permission on my main integration role');
      }
    }

    await checkRoleUpdate(oldRole, newRole);
  }
};
