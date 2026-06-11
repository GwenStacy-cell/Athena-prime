import { AuditLogEvent } from 'discord.js';
import { checkAntiNuke } from '../utils/antinuke.js';
import db from '../database.js';

export default {
  name: 'roleDelete',
  async execute(role) {
    if (!role.guild) return;
    if (role.managed) return; // skip bot/integration roles
    if (db.isModModeActive(role.guild.id)) return;

    // antinuke.js handles BOTH punishment AND restoration — do NOT duplicate here
    await checkAntiNuke(role.guild, 'Role Deletion', AuditLogEvent.RoleDelete, null, role);
  }
};
