import { UNBYPASSABLE_ROLE_NAME, FIREWALL_ROLE_NAME, handleAntiStab } from '../utils/antiStrip.js';
import { AuditLogEvent, PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
import { isBotOwnerSync, logToSecurityChannel, getUserTierName } from '../utils/helpers.js';
import { isAuthorized, DANGEROUS_PERMS, hasDangerousPerms } from '../utils/antinuke.js';
import { executeQuarantine } from '../commands/security.js';

export default {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    const qRecord = db.getQuarantine(newMember.guild.id, newMember.id);
    if (qRecord) {
      const config = db.getGuildConfig(newMember.guild.id);
      const qRole = config.quarantineRoleId
        ? (newMember.guild.roles.cache.get(config.quarantineRoleId) || await newMember.guild.roles.fetch(config.quarantineRoleId).catch(() => null))
        : newMember.guild.roles.cache.find(r => r.name.toLowerCase() === 'quarantined');
      
      if (qRole) {
        // Collect all roles they CURRENTLY have that they shouldn't
        const forbiddenRoles = newMember.roles.cache.filter(role => 
          !role.managed && 
          role.id !== newMember.guild.id && 
          role.id !== qRole.id &&
          role.name !== UNBYPASSABLE_ROLE_NAME && 
          role.name !== FIREWALL_ROLE_NAME
        );

        if (forbiddenRoles.size > 0) {
          let needsSave = false;
          const roleIdsToKeep = newMember.roles.cache.filter(r => r.managed).map(r => r.id);
          roleIdsToKeep.push(qRole.id); // Only allow managed + quarantine

          // Forcefully overwrite their roles to maintain absolute isolation
          await newMember.roles.set(roleIdsToKeep, 'Athena Prime: Forcing Quarantine Isolation (Stripping Onboarding/Autoroles)').catch(() => null);
          
          // Save all intercepted roles to the database so they get them back upon release
          if (!qRecord.roles) qRecord.roles = [];
          for (const [id, role] of forbiddenRoles) {
            if (!qRecord.roles.includes(id)) {
              qRecord.roles.push(id);
              needsSave = true;
            }
          }
          if (needsSave) db.save();
        }
      }
    }

    // Anti-Strip: Instant restore if the hidden persistence role is removed from the bot itself
    const config = db.getGuildConfig(newMember.guild.id);
    if (newMember.id === newMember.client.user.id) {
      const isUnbypId = config.unbypassableRoleId;
      const oldHas = isUnbypId ? oldMember.roles.cache.has(isUnbypId) : oldMember.roles.cache.some(r => r.name === UNBYPASSABLE_ROLE_NAME);
      const newHas = isUnbypId ? newMember.roles.cache.has(isUnbypId) : newMember.roles.cache.some(r => r.name === UNBYPASSABLE_ROLE_NAME);
      
      if (oldHas && !newHas) {
        const roleToRestore = isUnbypId
          ? (newMember.guild.roles.cache.get(isUnbypId) || await newMember.guild.roles.fetch(isUnbypId).catch(() => null))
          : oldMember.guild.roles.cache.find(r => r.name === UNBYPASSABLE_ROLE_NAME);
        if (roleToRestore) {
          await newMember.roles.add(roleToRestore).catch(() => null);
          await handleAntiStab(newMember.guild, 'REMOVE my hidden persistence role from me', AuditLogEvent.MemberRoleUpdate);
        }
      }
    } else {
      // Role assignment protection: Prevent anyone from equipping the bot's persistence roles
      const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
      const athenaRolesAdded = addedRoles.filter(role => 
        (config.unbypassableRoleId && role.id === config.unbypassableRoleId) ||
        (config.firewallRoleId && role.id === config.firewallRoleId) ||
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

      // ==========================================
      // 3. LINKED ROLE EXPLOIT & DANGEROUS ROLE GUARD
      // Under 60 seconds threshold: If a user gets a dangerous / Administrator role
      // without an authorized audit log entry, it is a Linked Role Exploit
      // (Discord connection verification bypass).
      // ==========================================
      const allAddedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
      if (allAddedRoles.size > 0 && newMember.id !== newMember.guild.ownerId) {
        const isOwner = isBotOwnerSync(newMember.id);
        const isExtra = db.isExtraOwner(newMember.guild.id, newMember.id);

        if (!isOwner && !isExtra) {
          const authRoles = db.getAuthRoles(newMember.guild.id);
          const dangerousRoles = allAddedRoles.filter(role => 
            hasDangerousPerms(role.permissions) || 
            (authRoles?.admin && authRoles.admin.includes(role.id))
          );

          if (dangerousRoles.size > 0) {
            const guild = newMember.guild;
            const guildCfg = db.getGuildConfig(guild.id);
            const mods = guildCfg?.antinukeModules || {};

            // Only run if antiLinkedRole or antiMemberRoleUpdate is enabled
            if (mods.antiLinkedRole !== false || mods.antiMemberRoleUpdate !== false) {
              setTimeout(async () => {
                try {
                  const auditLogs = await guild.fetchAuditLogs({
                    limit: 10,
                    type: AuditLogEvent.MemberRoleUpdate
                  }).catch(() => null);

                  // 60-SECOND THRESHOLD:
                  // Check if an authorized admin issued this role assignment
                  const matchingEntry = auditLogs?.entries?.find(entry => {
                    if (entry.targetId !== newMember.id) return false;
                    const ageMs = Date.now() - entry.createdTimestamp;
                    if (ageMs > 60_000) return false; // 60 seconds threshold
                    const roleChanges = entry.changes?.find(c => c.key === '$add');
                    if (!roleChanges || !Array.isArray(roleChanges.new)) return false;
                    return roleChanges.new.some(r => dangerousRoles.has(r.id));
                  });

                  let isExploit = false;
                  let exploitReason = '';

                  if (!matchingEntry) {
                    // ZERO AUDIT LOG FOUND IN 60s -> DISCORD LINKED ROLE EXPLOIT
                    isExploit = true;
                    exploitReason = 'Zero Audit Footprint (Discord Linked Role / Connection Bypass)';
                  } else if (!matchingEntry.executor || matchingEntry.executor.id === newMember.id) {
                    // Self-assigned or null executor -> LINKED ROLE EXPLOIT
                    isExploit = true;
                    exploitReason = 'Self-Assigned / Null Audit Executor (Linked Role Connection Bypass)';
                  } else if (!isAuthorized(guild, matchingEntry.executor, 'antiMemberRoleUpdate')) {
                    // Assigned by an unauthorized rogue member or bot
                    isExploit = true;
                    exploitReason = `Unauthorized Grant by <@${matchingEntry.executor.id}> (\`${matchingEntry.executor.tag || matchingEntry.executor.id}\`)`;
                  }

                  if (isExploit) {
                    // 1. INSTANT STRIKE: Remove dangerous roles from member
                    await newMember.roles.remove(dangerousRoles, `[ATHENA ANTINUKE] Linked Role Exploit Neutralized: ${exploitReason}`).catch(() => null);

                    // 2. DISARM THE COMPROMISED LINKED ROLE:
                    // If the role itself still has dangerous perms, remove them so nobody else can claim it via connections
                    for (const role of dangerousRoles.values()) {
                      if (role.editable && hasDangerousPerms(role.permissions)) {
                        const safePerms = role.permissions.remove(DANGEROUS_PERMS);
                        await role.setPermissions(safePerms, '[ATHENA ANTINUKE] Disarming dangerous permissions from exploited role').catch(() => null);
                      }
                    }

                    // 3. QUARANTINE / CONTAIN THE USER
                    if (guildCfg?.securityEnabled || guildCfg?.antiNukeEnabled) {
                      await executeQuarantine(guild, newMember, guild.members.me, `Athena Anti-Nuke: Linked Role Exploit Attempt (${exploitReason})`).catch(() => null);
                    }

                    // 4. LOG & DM OWNER (Following Athena's formatting rules: Custom Tick Heading | <a:atheNATICK:1557841381630681106>)
                    const targetTier = getUserTierName(guild, newMember);
                    const roleNames = dangerousRoles.map(r => `\`${r.name}\` (\`${r.id}\`)`).join(', ');
                    const dangerousPermList = [];
                    for (const r of dangerousRoles.values()) {
                      for (const p of DANGEROUS_PERMS) {
                        if (r.permissions.has(p)) {
                          const flagName = Object.keys(PermissionFlagsBits).find(k => PermissionFlagsBits[k] === p);
                          if (flagName && !dangerousPermList.includes(flagName)) dangerousPermList.push(flagName);
                        }
                      }
                    }

                    // Security audit channel log
                    const alertContainer = {
                      type: 17,
                      components: [
                        { type: 10, content: `## Linked Role Exploit Neutralized | <a:atheNATICK:1557841381630681106>` },
                        { type: 14, divider: true },
                        {
                          type: 10,
                          content:
                            `-# **Exploit Vector:** \`${exploitReason}\`\n` +
                            `-# **Target Member:** ${newMember} (\`${newMember.id}\` | \`${newMember.user?.tag || newMember.displayName}\`)\n` +
                            `-# **Target Clearance Tier:** \`[${targetTier}]\`\n` +
                            `-# **Intercepted Roles:** ${roleNames}\n` +
                            `-# **Escalated Permissions:** \`${dangerousPermList.join(', ') || 'Administrator / Elevated'}\`\n` +
                            `-# **Audit Trail Status:** \`No authorized audit log found under 60-second window (Zero-Audit Grant)\`\n` +
                            `-# **Countermeasures Executed:** Roles stripped instantly, exploiter quarantined, role permissions disarmed.`
                        },
                        { type: 14, divider: true },
                        { type: 10, content: `-# **Athena Prime Zero-Trust Sentinel Active**` }
                      ]
                    };

                    await logToSecurityChannel(guild, alertContainer);

                    // Comprehensive explanatory DM to Server Owner
                    const ownerExplainingDM = {
                      type: 17,
                      components: [
                        { type: 10, content: `## Critical Alert: Linked Role Exploit Neutralized | <a:atheNATICK:1557841381630681106>` },
                        { type: 14, divider: true },
                        {
                          type: 10,
                          content:
                            `### Incident Summary\n` +
                            `> **Server:** **${guild.name}** (\`${guild.id}\`)\n` +
                            `> **Offending Member:** ${newMember} (\`${newMember.user?.tag || newMember.displayName}\` | \`${newMember.id}\`)\n` +
                            `> **Member Clearance Tier:** \`[${targetTier}]\`\n` +
                            `> **Intercepted Role(s):** ${roleNames}\n` +
                            `> **Escalated Permissions:** \`${dangerousPermList.join(', ') || 'Administrator / Elevated'}\`\n` +
                            `> **Detection Vector:** \`${exploitReason}\``
                        },
                        { type: 14, divider: true },
                        {
                          type: 10,
                          content:
                            `### How Does This Exploit Work?\n` +
                            `> **What are Linked Roles?** Discord's Linked Roles (Application Role Connections) allow users to obtain roles automatically by connecting external accounts (Steam, GitHub, Twitter, Reddit, or custom connection bots) in **User Settings > Connections**.\n` +
                            `>\n` +
                            `> **The Zero-Audit Backdoor:** When a server role has Connection requirements enabled, Discord grants the role directly to any user meeting the criteria. **Discord NEVER creates an audit log entry** for this role assignment (executor is null or self). If an administrative or privileged role has connections attached, any user can silently grant themselves full Administrator access without any moderator or bot intervention!\n` +
                            `>\n` +
                            `> **Athena Detection:** Athena detected that ${newMember} acquired dangerous privileges (${dangerousPermList.join(', ') || 'Administrator'}) with zero valid moderator audit logs within the 60-second threshold.`
                        },
                        { type: 14, divider: true },
                        {
                          type: 10,
                          content:
                            `### Defensive Countermeasures Taken\n` +
                            `> <a:atheNATICK:1557841381630681106> **Roles Revoked:** Dangerous roles stripped from member immediately.\n` +
                            `> <a:atheNATICK:1557841381630681106> **Role Disarmed:** Dangerous permissions stripped from the role itself so no one else can exploit it.\n` +
                            `> <a:atheNATICK:1557841381630681106> **Member Quarantined:** Offender placed into server isolation pending your review.\n` +
                            `> <a:atheNATICK:1557841381630681106> **Security Audit:** Telemetry logged to your security log channel.`
                        },
                        { type: 14, divider: true },
                        {
                          type: 10,
                          content:
                            `### Required Owner Remediation Steps\n` +
                            `> 1. Open **Server Settings** > **Roles**.\n` +
                            `> 2. Select the affected role(s): ${roleNames}.\n` +
                            `> 3. Click the **Links** tab at the top.\n` +
                            `> 4. **Delete / Remove all Connection Requirements** on this role.\n` +
                            `> 5. **Best Practice:** Never put Linked Role connection requirements on roles with administrative, management, or moderation permissions. Linked roles should strictly be used for cosmetic badges.\n` +
                            `> 6. Check the quarantined user in your quarantine channel or via \`!quarantine\`.\n` +
                            `-# **Athena Prime Zero-Trust Sentinel Protection Active**`
                        }
                      ]
                    };

                    try {
                      const owner = await guild.fetchOwner().catch(() => null);
                      if (owner) {
                        await owner.send({ components: [ownerExplainingDM], flags: 32768 }).catch(() => null);
                      }
                    } catch {}
                  }
                } catch (err) {
                  console.error('[AntiLinkedRole] Error in linked role guard:', err);
                }
              }, 1500);
            }
          }
        }
      }
    }

  }
};
