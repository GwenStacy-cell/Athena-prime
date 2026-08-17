import db from '../database.js';
import embed from '../embed.js';
import { executeQuarantine } from '../commands/security.js';
import { logToSecurityChannel, getOrCreateQuarantineRole, getOrCreateQuarantineChannel } from '../utils/helpers.js';
import { sendWelcomeMessage } from '../commands/welcome.js';

import { logServerEvent } from '../utils/serverLogger.js';

export default {
  name: 'guildMemberAdd',
  async execute(member) {
    const guild = member.guild;
    const userId = member.id;
    const config = db.getGuildConfig(guild.id);

    // ==========================================
    // 0. BOT ADD GUARD
    // ==========================================
    if (member.user.bot) {
      // BotAdd is handled with zero-latency via the websocket hook (handleAuditLogEntry)
      // We do NOT proactively strip roles â€” legitimate bots that haven't been
      // whitelisted yet (MEE6, Dyno, Carl-bot etc.) would break immediately.
      return;
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
            `ï¸ You tried to rejoin **${guild.name}** while your quarantine isolation was still active. Access has been re-restricted.`,
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
    if (config.autoroleIds && config.autoroleIds.length > 0) {
      try {
        const rolesToAdd = [];
        for (const roleId of config.autoroleIds) {
          const role = guild.roles.cache.get(roleId);
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
        description: `Thank you for joining **${guild.name}**! <:dark4luvontop:1533860081916182721>\n\nYou are our **${getOrdinal(guild.memberCount)}** member! We hope you have a great time here. Stay safe!`,
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
      description: `__**Member Joined |**__ <:dark4luvontop:1533860081916182721>\n> **User:** ${member.user.tag} (<@${member.user.id}>)\n>  **Account Age:** ${ageDays} days old\n>  **Total Members:** ${guild.memberCount}`,
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

        const inviteChannel = guild.channels.cache.get(config.inviteChannelId);
        if (inviteChannel) {
          const inviter = usedInvite?.inviter;
          const inviterText = inviter ? `<@${inviter.id}> (${inviter.tag})` : 'Unknown / Vanity URL / Temp Invite';
          const codeText = usedInvite ? usedInvite.code : 'Unknown';
          const usesText = usedInvite ? usedInvite.uses : 'N/A';
          const maxUses = usedInvite ? (usedInvite.maxUses === 0 ? 'Infinite' : usedInvite.maxUses) : 'N/A';
          const maxAge = usedInvite ? (usedInvite.maxAge === 0 ? 'Permanent' : `${usedInvite.maxAge} seconds`) : 'N/A';
          const createdTime = usedInvite?.createdTimestamp ? `<t:${Math.floor(usedInvite.createdTimestamp / 1000)}:F>` : 'N/A';
          const bullet = '<a:61589pinkglock:1451707353450676265>';
          
          const inviteEmbed = {
            color: config.accentColor ? parseInt(config.accentColor.replace('#', ''), 16) : 0x2b2d31,
            author: { name: 'MEMBER JOINED', icon_url: member.user.displayAvatarURL({ dynamic: true }) },
            description: `${bullet} **User Joined:** ${member} (\`${member.id}\`)\n${bullet} **Account Created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n\n**INVITE DETAILS**\n${bullet} **Creator:** ${inviterText}\n${bullet} **Invite Code:** \`${codeText}\`\n${bullet} **Total Uses:** ${usesText} / ${maxUses}\n${bullet} **Duration:** ${maxAge}\n${bullet} **Created At:** ${createdTime}`,
            timestamp: new Date().toISOString(),
            thumbnail: { url: member.user.displayAvatarURL({ dynamic: true, size: 256 }) },
            footer: { text: `Total Members: ${guild.memberCount}`, icon_url: guild.iconURL({ dynamic: true }) }
          };
          
          await inviteChannel.send({ embeds: [inviteEmbed] }).catch(() => null);
        }
      } catch (err) {
        console.error('Failed to process invite tracking:', err);
      }
    }
  }
};
