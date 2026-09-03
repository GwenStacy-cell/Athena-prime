import cv2 from '../cv2.js';
import { isServerAdmin, isServerMod, isServerStaff, isBotOwnerSync, isExtraOwner } from '../utils/helpers.js';

export const commands = [
  {
    name: 'tier',
    description: 'Check your current Athena Prime authorization tier.',
    aliases: ['mytier', 'access', 'myaccess', 'perms'],
    category: 'utility',
    executePrefix: async (message, args) => {
      const member = message.member;
      const guild = message.guild;

      let highestTier = 'User Tier (No Special Access)';
      let color = 'info';
      
      const isOwner = isBotOwnerSync(member.id);
      const isServerOwner = member.id === guild.ownerId;
      const isExtra = isExtraOwner(guild.id, member.id);

      if (isOwner) {
        highestTier = '<:ticks:1533860039213842565> **Bot Developer (Omnipotent)**';
        color = 'success';
      } else if (isServerOwner) {
        highestTier = '<:ticks:1533860039213842565> **Server Owner (Root Access)**';
        color = 'success';
      } else if (isExtra) {
        highestTier = '<:ticks:1533860039213842565> **Extra Owner (Root Access)**';
        color = 'success';
      } else if (isServerAdmin(member, guild.id)) {
        highestTier = '<:ticks:1533860039213842565> **Admin Tier (Root Access)**';
        color = 'success';
      } else if (isServerMod(member, guild.id)) {
        highestTier = '<:emoji_16:1521464002046328944> **Mod Tier (Intermediate Access)**';
        color = 'warn';
      } else if (isServerStaff(member, guild.id)) {
        highestTier = '<:emoji_16:1521464002046328944> **Staff Tier (Basic Access)**';
        color = 'warn';
      }

      const payload = {
        type: 17,
        components: [
          {
            type: 9,
            components: [
              { type: 10, content: `## Authorization Clearance\n\n-# **User:** <@${member.id}>\n-# **Clearance Level:** ${highestTier}` }
            ],
            accessory: { type: 11, media: { url: member.user.displayAvatarURL({ extension: 'png', size: 128 }) } }
          }
        ]
      };

      await message.reply({ components: [payload], flags: 32768 }).catch(() => null);
    }
  }
];
