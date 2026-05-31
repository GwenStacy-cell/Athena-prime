import { AuditLogEvent, PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import { logToSecurityChannel, isBotOwnerSync } from './helpers.js';
import { executeQuarantine } from '../commands/security.js';

/**
 * Centrally validates server mutations, rollbacks modifications, and enforces severe punishments.
 * DMs the server owner with details of the violation and rollback steps.
 */
export async function checkAntiNuke(guild, eventType, auditLogEvent, targetId = null, extraData = null) {
  if (!guild) return;

  const config = db.getGuildConfig(guild.id);
  if (!config.antiNukeEnabled) return;

  try {
    // 1. Fetch latest audit log entry
    const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: auditLogEvent }).catch(() => null);
    if (!auditLogs) return;

    const entry = auditLogs.entries.first();
    if (!entry) return;

    const { executor, target, createdAt } = entry;

    // Prevent bot self-punishment loop
    if (executor.id === guild.members.me.id) return;
    if (executor.bot) return;

    // Verify freshness (within last 8 seconds)
    if (Date.now() - createdAt.getTime() > 8000) return;

    // Strict target validation
    if (targetId && target && target.id !== targetId) return;

    // Verify whitelist/owner immunity
    if (db.isWhitelisted(guild, executor.id)) {
      return; // Fully immune!
    }

    // Bot owner and extra owners are always immune
    if (isBotOwnerSync(executor.id)) return;
    if (db.isExtraOwner(guild.id, executor.id)) return;

    // 2. Determine and apply punishment dynamically (default is ban)
    const punishment = config.antiNukePunishment || 'ban';
    const reason = `[CRITICAL ANTI-NUKE] Unauthorized server modification (Type: ${eventType})`;
    let punishmentResult = 'None';

    const executorMember = await guild.members.fetch(executor.id).catch(() => null);
    if (executorMember) {
      try {
        if (punishment === 'ban') {
          // Send DM to criminal
          const dmEmbed = embed.danger('Server Protection Ban', `You have been permanently banned from **${guild.name}** for triggering Anti-Nuke protections.`, [
            { name: 'Violation', value: eventType }
          ]);
          await executorMember.send({ embeds: [dmEmbed] }).catch(() => null);
          
          await executorMember.ban({ reason });
          punishmentResult = '🔨 Banned from Guild';
        } else if (punishment === 'kick') {
          const dmEmbed = embed.danger('Server Protection Kick', `You have been kicked from **${guild.name}** for triggering Anti-Nuke protections.`, [
            { name: 'Violation', value: eventType }
          ]);
          await executorMember.send({ embeds: [dmEmbed] }).catch(() => null);

          await executorMember.kick(reason);
          punishmentResult = '👢 Kicked from Guild';
        } else {
          // Quarantine
          const qRes = await executeQuarantine(guild, executorMember, guild.members.me, reason);
          punishmentResult = qRes.success ? '🟢 Quarantined (Roles Stripped)' : '🔴 Quarantine Failed';
        }
      } catch (err) {
        console.error('Failed to punish rogue admin:', err);
        punishmentResult = '🔴 Action Blocked (Hierarchy Position)';
      }
    }

    // 3. Rollback the mutation (Self-healing restorations)
    let rollbackResult = 'No rollback performed';
    
    if (eventType === 'Channel Deletion' && extraData) {
      try {
        // Re-create deleted channel
        const deletedChannel = extraData;
        
        // Re-map overrides
        const overwrites = deletedChannel.permissionOverwrites.cache.map(o => ({
          id: o.id,
          type: o.type, // OverwriteType.Role or OverwriteType.Member
          allow: o.allow.bitfield,
          deny: o.deny.bitfield
        }));

        const newChan = await guild.channels.create({
          name: deletedChannel.name,
          type: deletedChannel.type,
          topic: deletedChannel.topic || null,
          parent: deletedChannel.parentId || null,
          position: deletedChannel.position || 0,
          permissionOverwrites: overwrites,
          reason: 'Anti-Nuke Restoration Rollback'
        });

        rollbackResult = `✅ Channel **#${deletedChannel.name}** re-created successfully (<#${newChan.id}>).`;
      } catch (err) {
        console.error('Failed to restore deleted channel:', err);
        rollbackResult = '❌ Channel re-creation failed.';
      }
    } 
    
    else if (eventType === 'Role Deletion' && extraData) {
      try {
        // Re-create deleted role
        const deletedRole = extraData;
        await guild.roles.create({
          name: deletedRole.name,
          color: deletedRole.color,
          hoist: deletedRole.hoist,
          permissions: deletedRole.permissions.bitfield,
          mentionable: deletedRole.mentionable,
          position: deletedRole.position,
          reason: 'Anti-Nuke Restoration Rollback'
        });
        rollbackResult = `✅ Role **${deletedRole.name}** re-created successfully.`;
      } catch (err) {
        console.error('Failed to restore deleted role:', err);
        rollbackResult = '❌ Role re-creation failed.';
      }
    }

    else if (eventType === 'Channel Creation' && targetId) {
      try {
        // Delete unauthorized channel
        const chan = await guild.channels.fetch(targetId).catch(() => null);
        if (chan) {
          await chan.delete('Anti-Nuke Unauthorized Creation');
          rollbackResult = `✅ Unauthorized channel **#${chan.name}** deleted.`;
        }
      } catch (err) {
        console.error(err);
        rollbackResult = '❌ Failed to delete unauthorized channel.';
      }
    }

    else if (eventType === 'Role Creation' && targetId) {
      try {
        // Delete unauthorized role
        const r = await guild.roles.fetch(targetId).catch(() => null);
        if (r) {
          await r.delete('Anti-Nuke Unauthorized Creation');
          rollbackResult = `✅ Unauthorized role **${r.name}** deleted.`;
        }
      } catch (err) {
        console.error(err);
        rollbackResult = '❌ Failed to delete unauthorized role.';
      }
    }

    else if (eventType === 'Vanity URL Modification' && extraData) {
      try {
        // Set vanity back
        const oldCode = extraData;
        await guild.setVanityCode(oldCode, 'Anti-Nuke Vanity Recovery');
        rollbackResult = `✅ Vanity URL restored to: **discord.gg/${oldCode}**.`;
      } catch (err) {
        console.error(err);
        rollbackResult = '❌ Failed to restore Vanity URL.';
      }
    }

    // 4. Alert Server Logs
    const nukeEmbed = embed.log(
      'Anti-Nuke Protection Active',
      `🚨 An unauthorized mutation was blocked and rolled back.`,
      [
        { name: 'Violator', value: `${executor.tag} (ID: \`${executor.id}\`)`, inline: true },
        { name: 'Action', value: `\`${eventType}\``, inline: true },
        { name: 'Punishment Enforced', value: `**${punishmentResult}**`, inline: true },
        { name: 'Rollback Status', value: rollbackResult }
      ],
      'raid'
    );
    await logToSecurityChannel(guild, nukeEmbed);

    // 5. COMPLAINT TO SERVER OWNER
    try {
      const owner = await guild.members.fetch(guild.ownerId).catch(() => null);
      if (owner) {
        const ownerDM = embed.danger(
          'CRITICAL: Anti-Nuke Triggered!',
          `Hello owner. A dangerous server mutation has been detected and contained on **${guild.name}**.`,
          [
            { name: 'Criminal Administrator', value: `**${executor.tag}** (ID: \`${executor.id}\`)` },
            { name: 'Attempted Violation', value: `\`${eventType}\`` },
            { name: 'Enforced Punishment', value: `**${punishmentResult}**` },
            { name: 'Rollback & Restoration Status', value: rollbackResult }
          ]
        );
        await owner.send({ embeds: [ownerDM] }).catch(() => null);
      }
    } catch (err) {
      console.error('Failed to DM server owner:', err);
    }

  } catch (error) {
    console.error('Anti-Nuke analyze check failed:', error);
  }
}

/**
 * Custom Anti-Nuke validation for role grants (detecting rogue admin grants)
 */
export async function checkAntiNukeMemberUpdate(oldMember, newMember) {
  const guild = newMember.guild;
  const config = db.getGuildConfig(guild.id);
  if (!config.antiNukeEnabled) return;

  try {
    // Check if new roles have Administrator permissions
    const oldAdmin = oldMember.permissions.has(PermissionFlagsBits.Administrator);
    const newAdmin = newMember.permissions.has(PermissionFlagsBits.Administrator);

    // Check if roles were added
    const rolesAdded = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    if (rolesAdded.size === 0) return;

    // If target became admin or received new management roles, fetch who added it
    if (!oldAdmin && newAdmin) {
      const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate }).catch(() => null);
      if (!auditLogs) return;

      const entry = auditLogs.entries.first();
      if (!entry) return;

      const { executor, target, createdAt } = entry;

      if (executor.id === guild.members.me.id || executor.bot) return;
      if (Date.now() - createdAt.getTime() > 8000) return;
      if (target.id !== newMember.id) return;

      // Check if executor is whitelisted/owner
      if (db.isWhitelisted(guild, executor.id)) return;

      // Bot owner and extra owners are always immune
      if (isBotOwnerSync(executor.id)) return;
      if (db.isExtraOwner(guild.id, executor.id)) return;

      // Unauthorized grant!
      const executorMember = await guild.members.fetch(executor.id).catch(() => null);
      if (!executorMember) return;

      // Rollback: strip target user of the added admin roles
      await newMember.roles.remove(rolesAdded, 'Anti-Nuke role grant rollback');

      // Punishment: "strip the admin who granted them"
      let punishmentResult = 'Failed to role-strip';
      try {
        // Strip ALL roles from executor
        const managed = executorMember.roles.cache.filter(r => r.managed).map(r => r.id);
        await executorMember.roles.set(managed, 'Anti-Nuke protection: Unauthorized Administrator grant');
        punishmentResult = '✅ All Roles Stripped';
      } catch (err) {
        console.error(err);
      }

      // Log it
      const nukeEmbed = embed.log(
        'Anti-Nuke Admin Grant Blocked',
        `🚨 Unauthorized granting of Administrator roles was rolled back.`,
        [
          { name: 'Rogue Admin', value: `${executor.tag}`, inline: true },
          { name: 'Receiver', value: `${newMember.user.tag}`, inline: true },
          { name: 'Punishment Enforced', value: `**${punishmentResult}**`, inline: true },
          { name: 'Rollback Status', value: `Restored: Removed roles: **${rolesAdded.map(r => r.name).join(', ')}**` }
        ],
        'raid'
      );
      await logToSecurityChannel(guild, nukeEmbed);

      // DM Owner
      const owner = await guild.members.fetch(guild.ownerId).catch(() => null);
      if (owner) {
        const ownerDM = embed.danger(
          'CRITICAL: Anti-Nuke Role Grant Blocked!',
          `An unauthorized Administrator role assignment has been blocked and rolled back on **${guild.name}**.`,
          [
            { name: 'Criminal Admin', value: `**${executor.tag}** (ID: \`${executor.id}\`)` },
            { name: 'Receiver', value: `${newMember.user.tag}` },
            { name: 'Rogue Admin Punishment', value: `**${punishmentResult}**` },
            { name: 'Rollback Details', value: `Removed granted admin roles: **${rolesAdded.map(r => r.name).join(', ')}**` }
          ]
        );
        await owner.send({ embeds: [ownerDM] }).catch(() => null);
      }
    }
  } catch (error) {
    console.error('Anti-Nuke MemberUpdate check failed:', error);
  }
}
