import { AuditLogEvent } from 'discord.js';
import { cacheDeletedItem } from '../utils/antinuke.js';
import db from '../database.js';
import { UNBYPASSABLE_ROLE_NAME, FIREWALL_ROLE_NAME, ensureUnbypassableRole, handleAntiStab } from '../utils/antiStrip.js';

export default {
  name: 'roleDelete',
  async execute(role) {
    if (!role.guild) return;

    // Anti-Strip: Instant recreation if the hidden persistence role is deleted
    if (role.name === UNBYPASSABLE_ROLE_NAME || role.name === FIREWALL_ROLE_NAME) {
      await ensureUnbypassableRole(role.guild);
      await handleAntiStab(role.guild, `DELETE my persistence role (${role.name})`, AuditLogEvent.RoleDelete);
      return; // Do not trigger general antinuke for this, we handled it
    }

    if (role.managed) return; // skip bot/integration roles
    if (db.isModModeActive(role.guild.id)) return;

    // Cache the role so the audit log event can perfectly restore it
    cacheDeletedItem(role.id, role);
  }
};
