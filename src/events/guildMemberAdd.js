import db from '../database.js';
import statsDB from '../statsDB.js';
import embed from '../embed.js';
import { executeQuarantine } from '../commands/security.js';
import { PermissionFlagsBits } from 'discord.js';
import { logToSecurityChannel, getOrCreateQuarantineRole, getOrCreateQuarantineChannel, isBotOwnerSync, getUserTierName, cleanDisplayName } from '../utils/helpers.js';
import { sendWelcomeMessage } from '../commands/welcome.js';
import { hasDangerousPerms, DANGEROUS_PERMS } from '../utils/antinuke.js';
import { logServerEvent } from '../utils/serverLogger.js';

export default {
  name: 'guildMemberAdd',
  async execute(member) {
    const guild = member.guild;
    const userId = member.id;
    const config = db.getGuildConfig(guild.id);

    // ==========================================
    // 0. BOT ADD GUARD � 1ms DIRECT STRIKE
    // ==========================================
    if (member.user.bot) {
      if ((config.securityEnabled || config.antiNukeEnabled) && config.antinukeModules?.antiBotAdd !== false) {
        import('../utils/antinuke.js').then(({ isBotAuthorized, rawBan, directStrike }) => {
          if (!isBotAuthorized(guild, member.id)) {
            // ? INSTANT 1ms ELIMINATION
            // We ban the bot instantly without waiting for the audit log!
            rawBan(guild.id, member.id, guild.client.token, '[ATHENA] Anti-Nuke: Unauthorized Bot Addition').catch(() => null);
            
            // Fire directStrike to find the executor (who added the bot) and ban them too
            directStrike(guild, 28 /* AuditLogEvent.BotAdd */, 'Unauthorized Bot Addition', member.id, null).catch(() => null);
          }
        });
      }
      return;
    }

    // ==========================================
    // 0.5. PRE-ASSIGNED DANGEROUS ROLE GUARD (ONBOARDING / PRE-LINKED)
    // ==========================================
    if (!member.user.bot && member.id !== guild.ownerId) {
      const isOwner = isBotOwnerSync(member.id);
      const isExtra = db.isExtraOwner(guild.id, member.id);
      if (!isOwner && !isExtra) {
        const authRoles = db.getAuthRoles(guild.id);
        const dangerousJoinRoles = member.roles.cache.filter(r => 
          r.id !== guild.id && 
          (hasDangerousPerms(r.permissions) || (authRoles?.admin && authRoles.admin.includes(r.id)))
        );

        if (dangerousJoinRoles.size > 0) {
          // 1. Remove dangerous roles from member immediately
          await member.roles.remove(dangerousJoinRoles, '[ATHENA ANTINUKE] Stripped dangerous roles acquired on join (Linked Role / Onboarding bypass)').catch(() => null);

          // 2. Disarm dangerous permissions from the roles themselves
          for (const role of dangerousJoinRoles.values()) {
            if (role.editable && hasDangerousPerms(role.permissions)) {
              const safePerms = role.permissions.remove(DANGEROUS_PERMS);
              await role.setPermissions(safePerms, '[ATHENA ANTINUKE] Disarming dangerous permissions from join-exploited role').catch(() => null);
            }
          }

          // 3. Quarantine the member
          if (config.securityEnabled || config.antiNukeEnabled) {
            await executeQuarantine(guild, member, guild.members.me, 'Athena Anti-Nuke: Member joined with unauthorized dangerous roles (Linked Role / Onboarding bypass)').catch(() => null);
          }

          // 4. Log to Security Channel & DM Server Owner with full explanation
          const targetTier = getUserTierName(guild, member);
          const roleNames = dangerousJoinRoles.map(r => `\`${r.name}\` (\`${r.id}\`)`).join(', ');
          const dangerousPermList = [];
          for (const r of dangerousJoinRoles.values()) {
            for (const p of DANGEROUS_PERMS) {
              if (r.permissions.has(p)) {
                const flagName = Object.keys(PermissionFlagsBits).find(k => PermissionFlagsBits[k] === p);
                if (flagName && !dangerousPermList.includes(flagName)) dangerousPermList.push(flagName);
              }
            }
          }

          const alertContainer = {
            type: 17,
            components: [
              { type: 10, content: `## Linked Role Exploit on Join Neutralized | <a:atheNATICK:1557841381630681106>` },
              { type: 14, divider: true },
              {
                type: 10,
                content:
                  `-# **Exploit Vector:** \`Pre-Assigned Roles on Join (Discord Linked Role / Onboarding Bypass)\`\n` +
                  `-# **Target Member:** ${member} (\`${member.id}\` | \`${member.user.tag}\`)\n` +
                  `-# **Target Clearance Tier:** \`[${targetTier}]\`\n` +
                  `-# **Intercepted Roles:** ${roleNames}\n` +
                  `-# **Escalated Permissions:** \`${dangerousPermList.join(', ') || 'Administrator / Elevated'}\`\n` +
                  `-# **Audit Trail Status:** \`Role pre-assigned upon guild entry without authorized moderator command\`\n` +
                  `-# **Countermeasures Executed:** Dangerous roles stripped, member quarantined, role permissions disarmed.`
              },
              { type: 14, divider: true },
              { type: 10, content: `-# **Athena Prime Zero-Trust Sentinel Active**` }
            ]
          };
          await logToSecurityChannel(guild, alertContainer);

          const ownerExplainingDM = {
            type: 17,
            components: [
              { type: 10, content: `## Critical Alert: Join-Time Linked Role Exploit Neutralized | <a:atheNATICK:1557841381630681106>` },
              { type: 14, divider: true },
              {
                type: 10,
                content:
                  `### Incident Summary\n` +
                  `> **Server:** **${guild.name}** (\`${guild.id}\`)\n` +
                  `> **Offending Member:** ${member} (\`${member.user.tag}\` | \`${member.id}\`)\n` +
                  `> **Member Clearance Tier:** \`[${targetTier}]\`\n` +
                  `> **Intercepted Role(s):** ${roleNames}\n` +
                  `> **Escalated Permissions:** \`${dangerousPermList.join(', ') || 'Administrator / Elevated'}\`\n` +
                  `> **Detection Vector:** \`Member joined with pre-assigned dangerous roles via Linked Role connection or Onboarding\``
              },
              { type: 14, divider: true },
              {
                type: 10,
                content:
                  `### How Does This Exploit Work?\n` +
                  `> **What are Linked Roles?** Discord's Linked Roles (Application Connections) allow users to obtain roles automatically by connecting external accounts in **User Settings > Connections**.\n` +
                  `>\n` +
                  `> **The Join Backdoor:** When a user with pre-linked connections joins a server that has connection requirements configured on administrative roles, Discord awards that role immediately upon joining with **zero audit logs**.\n` +
                  `>\n` +
                  `> **Athena Detection:** Athena intercepted ${member} entering the server with elevated privileges (${dangerousPermList.join(', ') || 'Administrator'}) and took immediate protective action.`
              },
              { type: 14, divider: true },
              {
                type: 10,
                content:
                  `### Defensive Countermeasures Taken\n` +
                  `> <a:atheNATICK:1557841381630681106> **Roles Revoked:** Dangerous roles stripped from member immediately upon joining.\n` +
                  `> <a:atheNATICK:1557841381630681106> **Role Disarmed:** Dangerous permissions stripped from the role itself.\n` +
                  `> <a:atheNATICK:1557841381630681106> **Member Quarantined:** Offender isolated from all channels pending review.\n` +
                  `> <a:atheNATICK:1557841381630681106> **Security Audit:** Telemetry logged to your security audit channel.`
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
                  `> 5. **Best Practice:** Never put Linked Role connection requirements on roles with administrative, management, or moderation permissions.\n` +
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
      }
    }

    // ==========================================
    // 1. QUARANTINE BYPASS PROTECTION
    // ==========================================
    const quarantineRecord = db.getQuarantine(guild.id, userId);

    if (quarantineRecord) {
      try {
        const role = await getOrCreateQuarantineRole(guild);
        const channel = await getOrCreateQuarantineChannel(guild, role);

        if (role) {
          // Immediately re-apply quarantine isolation
          await member.roles.set([role.id], 'Bypass containment: Member re-joined while under active quarantine.');

          // DM alert
          const bypassDM = embed.danger(
            'Quarantine Bypass Containment',
            `You tried to rejoin **${guild.name}** while your quarantine isolation was still active. Access has been re-restricted.`,
            [{ name: 'Reason', value: 'Quarantine bypass attempt detected.' }]
          );
          await member.send({ embeds: [bypassDM] }).catch(() => null);

          // Alert channel
          if (channel) {
            await channel.send({
              content: `${member}`,
              embeds: [embed.danger('Bypass Contained', `User **${member.user.tag}** has re-joined the server. Active quarantine has been re-applied instantly.`)]
            }).catch(() => null);
          }

          // Log security
          logToSecurityChannel(guild, embed.log(
            'Quarantine Bypass Contained',
            `User tried to leave and rejoin to escape quarantine.`,
            [
              { name: 'Target', value: `${member.user.tag} (${userId})`, inline: true },
              { name: 'Original Reason', value: quarantineRecord.reason }
            ],
            'danger'
          ));
        }
      } catch (error) {
        console.error('Failed to contain quarantine bypass:', error);
      }
      return; // Stop processing further checks
    }

    // ==========================================
    // 2. RAIDMODE ACTIVE ENFORCEMENT
    // ==========================================
    if (config.raidMode) {
      const reason = 'Automated Anti-Raid: Guild is currently under Lockdown / Raid Mode.';
      await executeQuarantine(guild, member, guild.members.me, reason);
      
      logToSecurityChannel(guild, embed.log(
        'Anti-Raid Quarantine Applied',
        `Account quarantined automatically during active Raid Mode.`,
        [{ name: 'Member Join', value: `${member.user.tag} (${userId})` }],
        'raid'
      ));
      return; // Stop further checks if quarantined
    }

    // ==========================================
    // 3. AUTOMATED NICKNAME ON JOIN
    // ==========================================
    if (config.autonick && config.autonick.enabled) {
      const { applyAutonick } = await import('../utils/helpers.js');
      await applyAutonick(member, config.autonick);
    }

    // ==========================================
    // 4. AUTOROLE
    // ==========================================
    const botRoleIds = Array.isArray(config.autoroleBot) ? config.autoroleBot : (config.autoroleBot ? [config.autoroleBot] : []);
    const humanRoleIds = Array.isArray(config.autoroleHuman) ? config.autoroleHuman : (config.autoroleHuman ? [config.autoroleHuman] : []);
    const legacyRoleIds = Array.isArray(config.autoroleIds) ? config.autoroleIds : (config.autoroleIds ? [config.autoroleIds] : []);
    
    const allAutoroleIds = member.user.bot
      ? [...legacyRoleIds, ...botRoleIds]
      : [...legacyRoleIds, ...humanRoleIds];
    if (allAutoroleIds.length > 0) {
      try {
        const rolesToAdd = [];
        for (const roleId of allAutoroleIds) {
          const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
          if (role && role.editable) {
            rolesToAdd.push(role);
          }
        }
        if (rolesToAdd.length > 0) {
          await member.roles.add(rolesToAdd, 'Athena Prime: Autorole').catch(() => null);
        }
      } catch (err) {
        console.error('Failed to assign autoroles:', err);
      }
    }

    // ==========================================
    // 5. WELCOME MESSAGE
    // ==========================================
    await sendWelcomeMessage(member);

    // ==========================================
    // 5.1 WELCOME DM
    // ==========================================
    try {
      const getOrdinal = (n) => {
        let s = ["th", "st", "nd", "rd"], v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };
      
      const welcomeDm = embed.build({
        title: `Welcome to ${guild.name}!`,
        description: `Thank you for joining **${guild.name}**! <a:uptime:1552608831060844575>\n\nYou are our **${getOrdinal(guild.memberCount)}** member! We hope you have a great time here. Stay safe!`,
        color: config.accentColor || '#2b2d31',
        thumbnail: guild.iconURL({ dynamic: true })
      });
      await member.send({ embeds: [welcomeDm] }).catch(() => null);
    } catch (err) {
      console.error('Failed to send welcome DM:', err);
    }

    // ==========================================
    // 5.5 SERVER LOGS
    // ==========================================
    const accountAge = Date.now() - member.user.createdAt.getTime();
    const ageDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));
    const joinEmbed = embed.build({
      description: `__**Member Joined |**__ <a:uptime:1552608831060844575>\n> **User:** ${member.user.tag} (<@${member.user.id}>)\n>  **Account Age:** ${ageDays} days old\n>  **Total Members:** ${guild.memberCount}`,
      color: '#2b2d31',
      thumbnail: member.user.displayAvatarURL({ dynamic: true })
    });
    await logServerEvent(guild, 'joins', joinEmbed);

    // ==========================================
    // 6. INVITE TRACKING
    // ==========================================
    if (config.inviteChannelId) {
      try {
        const newInvites = await guild.invites.fetch().catch(() => new Map());
        const oldInvites = member.client.invites?.get(guild.id) || new Map();
        
        let usedInvite = null;
        const possibleInvites = [];

        for (const [code, invite] of newInvites) {
          if (oldInvites.has(code)) {
            if (invite.uses > oldInvites.get(code)) {
              possibleInvites.push(invite);
            }
          } else {
            if (invite.uses > 0) {
              possibleInvites.push(invite);
            }
          }
        }

        if (possibleInvites.length === 1) {
          usedInvite = possibleInvites[0];
        } else if (possibleInvites.length > 1) {
          const withBaseline = possibleInvites.filter(i => oldInvites.has(i.code));
          if (withBaseline.length === 1) {
            usedInvite = withBaseline[0];
          } else {
            // Fallback: guess the most recently created invite among the candidates
            possibleInvites.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
            usedInvite = possibleInvites[0];
          }
        }
        
        // Update cache for next time
        if (member.client.invites) {
          member.client.invites.set(guild.id, new Map(newInvites.map(i => [i.code, i.uses])));
        }

        if (usedInvite?.inviter) {
          statsDB.logInvite(guild.id, usedInvite.inviter.id, member.id);
        }
        
        const inviteChannel = guild.channels.cache.get(config.inviteChannelId);
        if (inviteChannel) {
          const inviter = usedInvite?.inviter;
          const inviterText = inviter ? `<@${inviter.id}> (${inviter.tag})` : 'Unknown / Vanity URL / Temp Invite';
          const codeText = usedInvite ? usedInvite.code : 'Unknown';
          const usesText = usedInvite ? usedInvite.uses : 'N/A';
          const maxUses = usedInvite ? (usedInvite.maxUses === 0 ? 'Infinite' : usedInvite.maxUses) : 'N/A';
          const maxAge = usedInvite ? (usedInvite.maxAge === 0 ? 'Permanent' : `${usedInvite.maxAge} seconds`) : 'N/A';
          const createdTime = usedInvite?.createdTimestamp ? `<t:${Math.floor(usedInvite.createdTimestamp / 1000)}:F>` : 'N/A';
          const memberDisplayName = cleanDisplayName(member.nickname || member.user.displayName || member.user.username);
          const inviterDisplayName = inviter ? cleanDisplayName(inviter.displayName || inviter.username) : null;
          const inviterLine = inviter ? `[${inviterDisplayName}](https://discord.com/users/${inviter.id})`
            : 'Unknown / Vanity URL / Temp Invite';

          
            const inviteEmbed = {
              type: 17,
              components: [
                { type: 10, content: `## **MEMBER JOINED**` },
                { type: 14, divider: true },
                { 
                  type: 9, 
                  components: [
                    { type: 10, content: `**User Joined:** [${memberDisplayName}](https://discord.com/users/${member.id})\n**Account Created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` }
                  ],
                  accessory: { type: 11, media: { url: member.user.displayAvatarURL({ dynamic: true, size: 256 }) } }
                },
                { type: 14, divider: true },
                { type: 10, content: `**INVITE DETAILS**\n**Creator:** ${inviterLine}\n**Invite Code:** \`${codeText}\`\n**Total Uses:** ${usesText} / ${maxUses}\n**Duration:** ${maxAge}\n**Created At:** ${createdTime}` }
              ]
            };
            
            await inviteChannel.send({ components: inviteEmbed.components, flags: 32768 }).catch(() => null);

        }
      } catch (err) {
        console.error('Failed to process invite tracking:', err);
      }
    }
  }
};
