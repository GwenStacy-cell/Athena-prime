import { AuditLogEvent } from 'discord.js';
import { checkRoleUpdate } from '../utils/antinuke.js';

export default {
  name: 'roleUpdate',
  async execute(oldRole, newRole) {
    if (!newRole.guild) return;
    await checkRoleUpdate(oldRole, newRole);
  }
};
