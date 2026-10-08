import { PermissionFlagsBits } from 'discord.js';
import db from '../database.js';

export const commands = [
  {
    name: 'firewall',
    description: 'Displays the server firewall uptime and active status.',
    category: 'utility',
    permissions: [],
    async executePrefix(message) {
      return this.executeSlash(message);
    },
    async executeSlash(interaction) {
      const guildId = interaction.guild ? interaction.guild.id : (interaction.guildId || interaction.channel?.guild?.id);
      const isSlash = typeof interaction.reply === 'function';
      const user = interaction.author || interaction.user;
      
      const cfg = db.getGuildConfig(guildId);
      const isFirewallActive = cfg.antiNukeEnabled === true;
      const FIRE = '<a:fire:1557839005998121153>';
      
      // Calculate bot uptime for firewall uptime
      const uptimeMs = interaction.client.uptime;
      const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((uptimeMs / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((uptimeMs / 1000 / 60) % 60);
      const uptimeStr = `${days}d ${hours}h ${minutes}m`;
      
      const statusText = isFirewallActive ? 'ACTIVE & SECURING' : 'OFFLINE / VULNERABLE';
      
      const container = {
        type: 17,
        components: [
          { type: 10, content: `## ${FIRE} **FIREWALL STATUS**` },
          { type: 14, divider: true },
          { type: 10, content: `-# **Status:** ${statusText}` },
          { type: 10, content: `-# **Uptime:** ${uptimeStr}` },
          { type: 14, divider: true },
          { type: 10, content: '-# Athena Bulletproof Security System' }
        ]
      };
      
      const payload = { components: [container], flags: 32768 };
      
      let sentMsg;
      if (isSlash) {
        sentMsg = await interaction.reply({ ...payload, fetchReply: true });
      } else {
        sentMsg = await interaction.reply(payload);
      }
      
      // Auto-delete after 60 seconds
      setTimeout(() => {
        sentMsg.delete().catch(() => null);
      }, 60000);
      
      return sentMsg;
    }
  }
];
