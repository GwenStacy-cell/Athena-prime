import { PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import cv2 from '../cv2.js';
import { isBotOwnerSync, isExtraOwner, isAuthorized } from '../utils/helpers.js';
import db from '../database.js';

// ============================================================
// ACTIVE DRAG SESSIONS — keyed by `${guildId}:${targetUserId}`
// Holds the interval reference so it can be cleared by /vcdragstop
// ============================================================
const activeDrags = new Map();

export function isUserInDragSession(guildId, userId) {
  return activeDrags.has(`${guildId}:${userId}`);
}

export const commands = [
  // ─────────────────────────────────────────────
  // /vcdrag  —  Start dragging a user across VCs
  // ─────────────────────────────────────────────
  {
    name: 'vcdrag',
    description: 'Drags a user across every voice channel in an endless loop until /vcdragstop.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.MoveMembers],
    options: [
      { name: 'target', description: 'The user to drag', type: 6, required: true },
      { name: 'interval', description: 'Interval in seconds (default 2)', type: 4, required: false }
import { PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import cv2 from '../cv2.js';
import { isBotOwnerSync, isExtraOwner, isAuthorized } from '../utils/helpers.js';
import db from '../database.js';

// ============================================================
// ACTIVE DRAG SESSIONS — keyed by `${guildId}:${targetUserId}`
// Holds the interval reference so it can be cleared by /vcdragstop
// ============================================================
const activeDrags = new Map();

export function isUserInDragSession(guildId, userId) {
  return activeDrags.has(`${guildId}:${userId}`);
}

export const commands = [
  // ─────────────────────────────────────────────
  // /vcdrag  —  Start dragging a user across VCs
  // ─────────────────────────────────────────────
  {
    name: 'vcdrag',
    description: 'Drags a user across every voice channel in an endless loop until /vcdragstop.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.MoveMembers],
    options: [
      { name: 'target', description: 'The user to drag', type: 6, required: true },
      { name: 'interval', description: 'Interval in seconds (default 2)', type: 4, required: false }
    ],

    async executePrefix(message, args) {
      if (!(await isAuthorized(message.author, message.guild))) return message.reply(cv2.e.danger('Permission Denied', `${message.author} Only owners can use this command.`));
      const target = message.mentions.members.first();
      if (!target) {
        return message.reply(cv2.warn('Command Error',
            `${message.author} Please mention a valid member.\n\n**Usage:** \`!vcdrag <@user> [interval_seconds]\``));
      }
      const intervalSec = parseInt(args[1]) || 2;
      const result = await handleVcDrag(message.guild, message.member, target, intervalSec);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) return interaction.reply(cv2.e.danger('Permission Denied', `${interaction.user} Only owners can use this command.`));
      const target = interaction.options.getMember('target');
      const intervalSec = interaction.options.getInteger('interval') || 2;
      const result = await handleVcDrag(interaction.guild, interaction.member, target, intervalSec);
      await interaction.reply(result);
    }
  },

  // ─────────────────────────────────────────────
  // /vcdragstop  —  Stop an active drag session
  // ─────────────────────────────────────────────
  {
    name: 'vcdragstop',
    description: 'Stops an active /vcdrag session for a user.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.MoveMembers],
    options: [
      { name: 'target', description: 'The user to stop dragging', type: 6, required: true }
    ],

    async executePrefix(message) {
      if (!(await isAuthorized(message.author, message.guild))) return message.reply(cv2.e.danger('Permission Denied', `${message.author} Only owners can use this command.`));
      const target = message.mentions.members.first();
      if (!target) {
        return message.reply(cv2.warn('Command Error',
            `${message.author} Please mention the member whose drag session you want to stop.\n\n**Usage:** \`!vcdragstop <@user>\``));
      }
      const result = handleVcDragStop(message.guild, message.member, target);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) return interaction.reply(cv2.e.danger('Permission Denied', `${interaction.user} Only owners can use this command.`));
      const target = interaction.options.getMember('target');
      const result = handleVcDragStop(interaction.guild, interaction.member, target);
      await interaction.reply(result);
    }
  },

  // ─────────────────────────────────────────────
  // /vcdraglist  —  See all active drag sessions
  // ─────────────────────────────────────────────
  {
    name: 'vcdraglist',
  await Promise.all(promises);
  let msg = `Successfully moved **${count}** users from ${sourceVc} to ${destVc}.`;
  if (skipped > 0) msg += `\n\n>  **${skipped}** users were skipped due to active **Move Protection**.`;
  return cv2.success('Mass Move', msg);
}
