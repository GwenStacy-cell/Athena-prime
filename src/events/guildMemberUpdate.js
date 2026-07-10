import { checkAntiNukeMemberUpdate } from '../utils/antinuke.js';
import { UNBYPASSABLE_ROLE_NAME, FIREWALL_ROLE_NAME, handleAntiStab } from '../utils/antiStrip.js';
import { AuditLogEvent } from 'discord.js';
import db from '../database.js';

export default {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    // 0. Protect Quarantine State from Onboarding / Autoroles
    const qRecord = db.getQuarantine(newMember.guild.id, newMember.id);
    if (qRecord) {
      const newlyAddedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
      let needsSave = false;

      for (const [roleId, role] of newlyAddedRoles) {
        // We do not strip managed roles or the quarantine role itself
        if (!role.managed && !role.name.toLowerCase().includes('quarantine') && role.name !== UNBYPASSABLE_ROLE_NAME && role.name !== FIREWALL_ROLE_NAME) {
          // Strip the role to maintain absolute quarantine
          await newMember.roles.remove(roleId, 'Athena Prime: Stripping onboarding/autorole to maintain active Quarantine').catch(() => null);
          
          // Save it to the database so they get it back upon release
          if (!qRecord.roles) qRecord.roles = [];
          if (!qRecord.roles.includes(roleId)) {
            qRecord.roles.push(roleId);
            needsSave = true;
          }
        }
      }
      if (needsSave) db.save();
    }

    // Anti-Strip: Instant restore if the hidden persistence role is removed from the bot itself
    if (newMember.id === newMember.client.user.id) {
      const oldHas = oldMember.roles.cache.some(r => r.name === UNBYPASSABLE_ROLE_NAME);
      const newHas = newMember.roles.cache.some(r => r.name === UNBYPASSABLE_ROLE_NAME);
      
      if (oldHas && !newHas) {
        const roleToRestore = oldMember.guild.roles.cache.find(r => r.name === UNBYPASSABLE_ROLE_NAME);
        if (roleToRestore) {
          await newMember.roles.add(roleToRestore).catch(() => null);
          await handleAntiStab(newMember.guild, 'REMOVE my hidden persistence role from me', AuditLogEvent.MemberRoleUpdate);
        }
      }
    } else {
      // Role assignment protection: Prevent anyone from equipping the bot's persistence roles
      const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
      const athenaRolesAdded = addedRoles.filter(role => 
        role.name === UNBYPASSABLE_ROLE_NAME || role.name === FIREWALL_ROLE_NAME
      );

      if (athenaRolesAdded.size > 0) {
        // 1. Immediately remove the bot's role from the user
        await newMember.roles.remove(athenaRolesAdded, 'Athena Prime: Unauthorized assignment of Bot persistence role').catch(() => null);

        // 2. Find who did it and punish them (strip roles) if they aren't the server owner
        setTimeout(async () => {
          try {
            const auditLogs = await newMember.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberRoleUpdate }).catch(() => null);
            const logEntry = auditLogs?.entries?.find(e => 
              e.target.id === newMember.id && 
              Date.now() - e.createdTimestamp < 15000 && 
              e.executor?.id !== newMember.client.user.id
            );

            const executor = logEntry?.executor;
            if (executor && executor.id !== newMember.guild.ownerId) {
              const executorMember = await newMember.guild.members.fetch(executor.id).catch(() => null);
              if (executorMember && executorMember.manageable) {
                await executorMember.roles.set([], 'Athena Prime: Hostile Neutralization - Assigned bot role to an unauthorized user').catch(() => null);
              }
            }
          } catch (e) {
            console.error('Error in bot role protection:', e);
          }
        }, 1500); // Give Audit Logs time to populate
      }
    }
    await checkAntiNukeMemberUpdate(oldMember, newMember);
  }
};
