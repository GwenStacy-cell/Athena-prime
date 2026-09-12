import cv2 from '../cv2.js';
import db from '../database.js';
import { PermissionFlagsBits, MessageFlags } from 'discord.js';

export const commands = [
  {
    name: 'shortcuts',
    aliases: ['sc'],
    description: 'Manage and view Athena Prime short cut aliases.',
    category: 'utilities',
    permissions: [],
    options: [],
    async executePrefix(message, args) {
      const config = db.getGuildConfig(message.guild.id);
      
      if (args[0] === 'enable') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && !['1509084068619489331'].includes(message.author.id)) {
            return message.reply(cv2.danger('Permission Denied', 'You must be an Administrator to enable shortcuts.'));
        }
        db.updateGuildConfig(message.guild.id, { shortcutsEnabled: true });
        return message.reply(cv2.success('Shortcuts Enabled', 'All pre-added short cut aliases are now **enabled** server-wide!'));
      }
      
      if (args[0] === 'disable') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && !['1509084068619489331'].includes(message.author.id)) {
            return message.reply(cv2.danger('Permission Denied', 'You must be an Administrator to disable shortcuts.'));
        }
        db.updateGuildConfig(message.guild.id, { shortcutsEnabled: false });
        return message.reply(cv2.success('Shortcuts Disabled', 'All pre-added short cut aliases have been **disabled** server-wide. Users must now type full command names.'));
      }
      
      const enabledText = config.shortcutsEnabled !== false ? '<:on:1533844867191406672> **Enabled**' : '<:off:1533844858983157851> **Disabled**';
      
      const text = `# Athena Shortcuts Manager\n` +
      `- Global Status: ${enabledText}\n\n` +
      `**[ SECURITY ]**\n` +
      `> \`!sec\` or \`!shield\` ➔ \`!security\`\n` +
      `> \`!an\` ➔ \`!antinuke\`\n` +
      `> \`!cfg\` ➔ \`!config\`\n` +
      `> \`!qr\` or \`!q\` ➔ \`!quarantine\`\n` +
      `> \`!unq\` ➔ \`!unquarantine\`\n` +
      `> \`!mq\` ➔ \`!massquarantine\`\n` +
      `> \`!muq\` ➔ \`!massunquarantine\`\n` +
      `> \`!ld\` or \`!lock\` ➔ \`!lockdown\`\n` +
      `> \`!em\` or \`!panic\` ➔ \`!emergency\`\n` +
      `> \`!bl\` or \`!wf\` ➔ \`!blacklist\`\n` +
      `> \`!scan\` ➔ \`!scanserver\`\n` +
      `> \`!raid\` or \`!rm\` ➔ \`!raidmode\`\n\n` +
      `**[ MODERATION ]**\n` +
      `> \`!b\` ➔ \`!ban\`\n` +
      `> \`!k\` ➔ \`!kick\`\n` +
      `> \`!m\` ➔ \`!mute\`\n` +
      `> \`!to\` ➔ \`!timeout\`\n` +
      `> \`!w\` ➔ \`!warn\`\n` +
      `> \`!cw\` ➔ \`!clearwarns\`\n` +
      `> \`!c\` or \`!clear\` ➔ \`!purge\`\n\n` +
      `**[ UTILITIES ]**\n` +
      `> \`!p\` ➔ \`!ping\`\n` +
      `> \`!av\` or \`!pfp\` ➔ \`!avatar\`\n` +
      `> \`!brb\` ➔ \`!afk\`\n\n` +
      `- Use \`!shortcuts enable\` or \`!shortcuts disable\` to toggle these aliases globally for your server.`;
      
      const container = { type: 17, components: [{ type: 10, content: text }] };
      return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    },
    async executeSlash(interaction) {
      await interaction.reply({ content: 'Please use the prefix command `!shortcuts` for this feature.', ephemeral: true });
    }
  }
];
