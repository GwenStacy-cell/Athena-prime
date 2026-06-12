import { PermissionFlagsBits } from 'discord.js';

export const UNBYPASSABLE_ROLE_NAME = 'Athena Unbypassable';

export async function ensureUnbypassableRole(guild) {
  if (!guild || !guild.members.me) return null;
  if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) return null;

  try {
    let unbypassableRole = guild.roles.cache.find(r => r.name === UNBYPASSABLE_ROLE_NAME);

    // 1. Create if missing
    if (!unbypassableRole) {
      unbypassableRole = await guild.roles.create({
        name: UNBYPASSABLE_ROLE_NAME,
        permissions: [PermissionFlagsBits.Administrator],
        color: '#2b2d31', // Dark discord color
        hoist: false,
        mentionable: false,
        reason: 'Athena Prime Unbypassable Persistence'
      });
    }

    // 2. Ensure it has Administrator
    if (!unbypassableRole.permissions.has(PermissionFlagsBits.Administrator)) {
      await unbypassableRole.setPermissions([PermissionFlagsBits.Administrator], 'Athena Prime Unbypassable Persistence').catch(() => null);
    }

    // 3. Move it as high as mathematically possible
    // A bot can only assign/move roles BELOW its own highest role.
    const botHighestPos = guild.members.me.roles.highest.position;
    if (unbypassableRole.position < botHighestPos - 1) {
      await unbypassableRole.setPosition(botHighestPos - 1).catch(() => null);
    }

    // 4. Ensure the bot has the role assigned to itself
    if (!guild.members.me.roles.cache.has(unbypassableRole.id)) {
      await guild.members.me.roles.add(unbypassableRole).catch(() => null);
    }

    return unbypassableRole;
  } catch (error) {
    console.error(`[AntiStrip] Failed to ensure unbypassable role in ${guild.name}:`, error.message);
    return null;
  }
}

import embed from '../embed.js';
import { AuditLogEvent } from 'discord.js';

export async function handleAntiStab(guild, actionText, auditLogType) {
  try {
    // 1. Give Discord API a brief moment to register the audit log
    await new Promise(r => setTimeout(r, 1000));
    
    // 2. Fetch Audit Logs to find the stabber
    const auditLogs = await guild.fetchAuditLogs({ limit: 5, type: auditLogType }).catch(() => null);
    const logEntry = auditLogs?.entries?.find(e => Date.now() - e.createdTimestamp < 10000);
    const executor = logEntry?.executor;

    // 3. Attempt to strip roles and ban the stabber if they aren't the server owner
    let punishedText = '';
    if (executor && executor.id !== guild.ownerId && executor.id !== guild.client.user.id) {
      try {
        const member = await guild.members.fetch(executor.id).catch(() => null);
        if (member && member.bannable) {
          await member.roles.set([], 'Anti-Stab: Stripping roles from rogue admin').catch(() => null);
          await member.ban({ reason: `Anti-Stab: Attempted to ${actionText}` }).catch(() => null);
          punishedText = `\n\nI have successfully stripped their roles and **BANNED** them from the server to neutralize the threat.`;
        } else {
          punishedText = `\n\nI attempted to ban them, but their top role is higher than mine or they are the server owner.`;
        }
      } catch (e) {
        punishedText = `\n\nFailed to ban them automatically (missing permissions or hierarchy).`;
      }
    } else if (executor?.id === guild.ownerId) {
      punishedText = `\n\nSince they are the Server Owner, I cannot ban them, but I have forced my permissions back on.`;
    }

    // 4. Alert the Server Owner (NO EMOJIS)
    const owner = await guild.fetchOwner().catch(() => null);
    if (!owner) return;
    
    const stabberMention = executor ? `<@${executor.id}> (${executor.tag})` : 'an Unknown Admin (Audit log hidden)';
    
    const alertEmbed = embed.danger(
      'ANTI-STAB WARNING: Security Compromised',
      `**Server:** ${guild.name}\n\nSomeone just attempted to **${actionText}**!\n\n**Stabber Detected:** ${stabberMention}${punishedText}\n\nI have instantly forced my permissions back on to protect the server. Please review your audit logs.`
    );
    
    // Remove all emojis from the embed title
    alertEmbed.data.title = alertEmbed.data.title.replace(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu, '').trim();

    await owner.send({ embeds: [alertEmbed] }).catch(() => null);
  } catch (err) {
    // Ignore if DMs are closed
  }
}
