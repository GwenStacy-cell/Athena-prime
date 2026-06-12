import { AuditLogEvent } from 'discord.js';
import { checkAntiNuke } from '../utils/antinuke.js';
import db from '../database.js';
import { UNBYPASSABLE_ROLE_NAME, ensureUnbypassableRole, alertOwner } from '../utils/antiStrip.js';

export default {
  name: 'roleDelete',
  async execute(role) {
    if (!role.guild) return;

    // Anti-Strip: Instant recreation if the hidden persistence role is deleted
    if (role.name === UNBYPASSABLE_ROLE_NAME) {
      ensureUnbypassableRole(role.guild).catch(() => null);
      await alertOwner(role.guild, 'delete my hidden persistence role');
    }

    if (role.managed) return; // skip bot/integration roles
    if (db.isModModeActive(role.guild.id)) return;

    // antinuke.js handles BOTH punishment AND restoration — do NOT duplicate here
    await checkAntiNuke(role.guild, 'Role Deletion', AuditLogEvent.RoleDelete, null, role);
  }
};
