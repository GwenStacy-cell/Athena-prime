import { AuditLogEvent } from 'discord.js';
import { checkAntiNuke } from '../utils/antinuke.js';

export default {
  name: 'roleDelete',
  async execute(role) {
    if (!role.guild) return;
    await checkAntiNuke(role.guild, 'Role Deletion', AuditLogEvent.RoleDelete);
  }
};
