import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

import db from '../database.js';

export const commands = [
  {
    name: 'bjoins',
    aliases: ['bjoin', 'botjoins'],
    description: 'View recent bot join statistics.',
    category: 'utilities',
    permissions: [],
    async executePrefix(message, args) {
      const stats = db.cache.botAnalytics || { joins: 0, leaves: 0, cmds: {} };
      const cfg = db.getGuildConfig(message.guild?.id || '0');
      const accentInt = cfg.accentColor ? parseInt(cfg.accentColor.replace('#', ''), 16) : 0x2b2d31;

      const e = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(`<a:AnyaYay:1537513785718476850> **Bot Joins:** ${stats.joins} Servers Joined`);

      await message.reply({ embeds: [e] });
    }
  },
  {
    name: 'bleaves',
    aliases: ['bleave', 'botleaves'],
    description: 'View recent bot leave statistics.',
    category: 'utilities',
    permissions: [],
    async executePrefix(message, args) {
      const stats = db.cache.botAnalytics || { joins: 0, leaves: 0, cmds: {} };
      const cfg = db.getGuildConfig(message.guild?.id || '0');
      const accentInt = cfg.accentColor ? parseInt(cfg.accentColor.replace('#', ''), 16) : 0x2b2d31;

      const e = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(`⚠️ **Bot Leaves:** ${stats.leaves} Servers Left`);

      await message.reply({ embeds: [e] });
    }
  },
  {
    name: 'bsummary',
    aliases: ['bgrowth', 'bjoinssummary'],
    description: 'View bot join and growth summary.',
    category: 'utilities',
    permissions: [],
    async executePrefix(message, args) {
      const stats = db.cache.botAnalytics || { joins: 0, leaves: 0, cmds: {} };
      const cfg = db.getGuildConfig(message.guild?.id || '0');
      const accentInt = cfg.accentColor ? parseInt(cfg.accentColor.replace('#', ''), 16) : 0x2b2d31;
      const net = stats.joins - stats.leaves;

      const e = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(`<:emoji_25:1515041866796503180> **Growth Summary:**\n> Joins: ${stats.joins}\n> Leaves: ${stats.leaves}\n> Net Growth: ${net > 0 ? '+' : ''}${net}`);

      await message.reply({ embeds: [e] });
    }
  },
  {
    name: 'bcmds',
    aliases: ['bcmd', 'botcmds', 'btopcmds', 'btop', 'bcmdusers'],
    description: 'View command usage analytics & top executed commands.',
    category: 'utilities',
    permissions: [],
    async executePrefix(message, args) {
      const stats = db.cache.botAnalytics?.cmds || {};
      const sortedCmds = Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 10);
      
      let lines = [];
      let total = 0;
      for (const val of Object.values(stats)) total += val;

      if (sortedCmds.length === 0) {
        lines.push('*No commands executed yet.*');
      } else {
        sortedCmds.forEach(([cmd, count], i) => {
          lines.push(`**${i + 1}.** \`${cmd}\` — ${count} uses`);
        });
      }

      const cfg = db.getGuildConfig(message.guild?.id || '0');
      const accentInt = cfg.accentColor ? parseInt(cfg.accentColor.replace('#', ''), 16) : 0x2b2d31;

      const e = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(`<a:AnyaYay:1537513785718476850> **Top 10 Executed Commands:**\n\n${lines.join('\n')}\n\n**Total Commands Executed:** ${total}`);

      await message.reply({ embeds: [e] });
    }
  },
  {
    name: 'bservers',
    aliases: ['bmem', 'bping'],
    description: 'View active bot servers, memory & latency.',
    category: 'utilities',
    permissions: [],
    async executePrefix(message, args) {
      const client = message.client;
      const serverCount = client.guilds.cache.size;
      const memberCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
      const ping = Math.round(client.ws.ping);
      const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;

      const cfg = db.getGuildConfig(message.guild?.id || '0');
      const accentInt = cfg.accentColor ? parseInt(cfg.accentColor.replace('#', ''), 16) : 0x2b2d31;

      const e = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(`<:emoji_25:1515041866796503180> **Live Bot Metrics:**\n> **Servers:** ${serverCount}\n> **Users:** ${memberCount}\n> **Latency:** ${ping}ms\n> **RAM Usage:** ${Math.round(memUsage)} MB`);

      await message.reply({ embeds: [e] });
    }
  }
];
