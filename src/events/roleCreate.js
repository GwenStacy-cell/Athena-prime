import { AuditLogEvent } from 'discord.js';
import { checkAntiNuke } from '../utils/antinuke.js';

export default {
  name: 'roleCreate',
  async execute(role) {
    if (!role.guild) return;
    await checkAntiNuke(role.guild, 'Role Creation', AuditLogEvent.RoleCreate, role.id);
  }
};
