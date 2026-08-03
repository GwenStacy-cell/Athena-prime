import { AuditLogEvent, PermissionFlagsBits } from 'discord.js';
import { checkRoleUpdate } from '../utils/antinuke.js';
import { UNBYPASSABLE_ROLE_NAME, FIREWALL_ROLE_NAME, handleAntiStab } from '../utils/antiStrip.js';

export default {
  name: 'roleUpdate',
  async execute(oldRole, newRole) {
    if (!newRole.guild) return;

    // Sync Secondary and Hidden role positions if Primary role is moved up
    if (newRole.tags?.botId === newRole.client.user.id && newRole.position > oldRole.position) {
      const secondary = newRole.guild.roles.cache.find(r => r.name === 'Athena Firewall' || r.name === FIREWALL_ROLE_NAME);
      const hidden = newRole.guild.roles.cache.find(r => r.name === 'Athena Unbypassable' || r.name === UNBYPASSABLE_ROLE_NAME);
      
      const updates = [];
      // To place them directly below the primary role in order:
      // Primary position is newRole.position
      // Secondary position should be newRole.position - 1
      // Hidden position should be newRole.position - 2
      // Discord's setPositions handles relative moving. We'll give them the desired explicit positions.
      
      if (secondary && secondary.editable) updates.push({ role: secondary, position: Math.max(1, newRole.position - 1) });
      if (hidden && hidden.editable) updates.push({ role: hidden, position: Math.max(1, newRole.position - 2) });
      
      if (updates.length > 0) {
        try {
          await newRole.guild.roles.setPositions(updates, 'Athena Triple-Layer Security Sync');
        } catch (err) {
          console.error('Failed to sync security roles positions:', err);
        }
      }
    }

    // Anti-Strip: Instant restore if the persistence roles lose Admin
    if (newRole.name === UNBYPASSABLE_ROLE_NAME || newRole.name === FIREWALL_ROLE_NAME) {
      if (!newRole.permissions.has(PermissionFlagsBits.Administrator)) {
        try {
          await newRole.setPermissions([PermissionFlagsBits.Administrator], `Athena Prime ${newRole.name} Persistence`);
        } catch (err) {
          // If we can't edit it (e.g. moved above our highest role), create a new one!
          const { ensureUnbypassableRole } = await import('../utils/antiStrip.js');
          await ensureUnbypassableRole(newRole.guild);
        }
        await handleAntiStab(newRole.guild, `turn off the Administrator permission on my ${newRole.name} role`, AuditLogEvent.RoleUpdate);
      }
    }

    // Anti-Strip: Alert if the bot's integration role loses Admin
    if (newRole.managed && newRole.tags?.botId === newRole.client.user.id) {
      if (oldRole.permissions.has(PermissionFlagsBits.Administrator) && !newRole.permissions.has(PermissionFlagsBits.Administrator)) {
        // Try to turn it back on!
        try {
          await newRole.setPermissions([PermissionFlagsBits.Administrator], 'Athena Prime Auto-Restore Admin');
        } catch (err) {
          // If Discord blocks editing the managed role, rely on the hidden role
          const { ensureUnbypassableRole } = await import('../utils/antiStrip.js');
          await ensureUnbypassableRole(newRole.guild);
        }
        await handleAntiStab(newRole.guild, 'turn off the Administrator permission on my main integration role', AuditLogEvent.RoleUpdate);
      }
    }

    await checkRoleUpdate(oldRole, newRole);
  }
};
