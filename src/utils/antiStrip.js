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

export async function alertOwner(guild, actionText) {
  try {
    const owner = await guild.fetchOwner().catch(() => null);
    if (!owner) return;
    const alertEmbed = embed.danger(
      '⚠️ ANTI-STAB WARNING: Security Compromised',
      `**Server:** ${guild.name}\n\nSomeone just attempted to **${actionText}**!\n\nI have instantly forced my permissions back on to protect the server, but you should review your audit logs immediately to find the rogue admin.`
    );
    await owner.send({ embeds: [alertEmbed] }).catch(() => null);
  } catch (err) {
    // Ignore if DMs are closed
  }
}
