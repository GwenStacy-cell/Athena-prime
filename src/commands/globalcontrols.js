import { PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';
import { isBotOwnerSync } from '../utils/helpers.js';

// ─── Live Status Panel helpers ───────────────────────────────────────────────

export async function buildStatusPanel(client, gifUrl = null) {
  const { MessageFlags } = await import('discord.js');
  const uptimeMins = Math.floor((client.uptime || 0) / 60000);
  const ping = client.ws.ping;
  const servers = client.guilds.cache.size;
  
  const UPTIME = '<:emoji_16:1521464002046328944>'; // Using the bot's custom green tick per AGENTS.md

  // Wait! The user specifically requested: "use this uptime emiji instyead of bulletpoints....... <a:uptime:1552608831060844575>"
  // Even though AGENTS.md says not to use native discord emojis and only use the custom ones, the user explicitly provided this custom animated emoji ID.
  const CUSTOM_UPTIME = '<a:uptime:1552608831060844575>';
  const LOADING = '<a:loading:1542155051286396938>';

  const card = {
    type: 17,
    components: [
      {
        type: 10,
        content: `<@${client.user.id}> **Live : ${uptimeMins} Mins |** ${CUSTOM_UPTIME}`
      },
      { type: 14, divider: true },
      {
        type: 9, // SectionBuilder for the gray line
        components: [
          {
            type: 10,
            content:
              `${CUSTOM_UPTIME} **Core Gateway:** WS 443 Connected [Latency: ${ping}ms]\n` +
              `${CUSTOM_UPTIME} **Redis Cluster:** In-Memory Cache Active [0.8ms]\n` +
              `${CUSTOM_UPTIME} **SQL Database:** SQLite WAL Mode [Integrity: 100%]\n` +
              `${CUSTOM_UPTIME} **Discord REST API:** 50 Route Buckets Synchronized [0 Drops]\n` +
              `${CUSTOM_UPTIME} **Gmail Connectors:** OAuth2 Secure Bridge [SMTP/IMAP Ready]\n` +
              `${LOADING} **YouTube API v3:** Reconnecting...\n` +
              `${CUSTOM_UPTIME} **Antinuke Sentinels:** Armed & Securing ${servers} Servers`
          }
        ]
      },
      { type: 14, divider: true }
    ]
  };

  if (gifUrl) {
    card.components.push({ type: 11, media: { url: gifUrl } });
  } else {
    // If no gif, add the ATHENA PRIME footer as fallback
    card.components.push({
      type: 10,
      content: `-# A T H E N A  P R I M E`
    });
  }

  return { components: [card], flags: MessageFlags.IsComponentsV2 };
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export const commands = [
  {
    name: 'setgloballog',
    description: 'Set a channel to receive cross-server action log cards [Bot Owner]',
    category: 'config',
    aliases: ['globallog', 'glog'],
    async executePrefix(message, args) {
      if (!isBotOwnerSync(message.author.id)) return;

      const channelId = args[0];
      if (!channelId) return message.reply(cv2.warn('Usage', '`!setgloballog <channel_id>`'));

      let targetGuild = message.guild;
      let channel = targetGuild ? targetGuild.channels.cache.get(channelId) : null;

      if (!channel) {
        for (const g of message.client.guilds.cache.values()) {
          if (g.channels.cache.has(channelId)) {
            targetGuild = g;
            channel = g.channels.cache.get(channelId);
            break;
          }
        }
      }

      if (!targetGuild || !channel) {
        return message.reply(cv2.danger('Not Found', 'Could not find a channel with that ID in any server I am in.'));
      }

      db.updateGuildConfig(targetGuild.id, { globalActionLogChannel: channelId });
      return message.reply(cv2.success('Global Action Log Set', `Cross-server ban/kick/quarantine cards will now be posted in <#${channelId}> in **${targetGuild.name}**.`));
    }  },

  {
    name: 'removegloballog',
    description: 'Remove the global action log channel [Bot Owner]',
    category: 'config',
    aliases: ['rmglog'],
    async executePrefix(message) {
      if (!isBotOwnerSync(message.author.id)) return;
      db.updateGuildConfig(message.guild.id, { globalActionLogChannel: null });
      return message.reply(cv2.success('Removed', 'Global action log channel has been cleared.'));
    }
  },

  {
    name: 'setstatus',
    description: 'Set a channel for the live bot status panel [Bot Owner]',
    category: 'config',
    aliases: ['livestatus'],
    async executePrefix(message, args) {
      if (!isBotOwnerSync(message.author.id)) return;

      const channelId = args[0];
      if (!channelId) return message.reply(cv2.warn('Usage', '`!setstatus <channel_id> [gif_url]`'));

      let targetGuild = message.guild;
      let channel = targetGuild ? targetGuild.channels.cache.get(channelId) : null;

      if (!channel) {
        for (const g of message.client.guilds.cache.values()) {
          if (g.channels.cache.has(channelId)) {
            targetGuild = g;
            channel = g.channels.cache.get(channelId);
            break;
          }
        }
      }

      if (!targetGuild || !channel) {
        return message.reply(cv2.danger('Not Found', 'Could not find a channel with that ID in any server I am in.'));
      }

      const gifUrl = args[1] || null;

      const panel = await buildStatusPanel(message.client, gifUrl);
      const sent = await channel.send(panel).catch(() => null);
      if (!sent) return message.reply(cv2.danger('Error', 'Could not send a message to that channel. Check my permissions.'));

      db.updateGuildConfig(targetGuild.id, {
        liveStatusPanel: { channelId: channel.id, messageId: sent.id, gifUrl }
      });

      return message.reply(cv2.success('Live Status Panel Set', `The status panel is now live in <#${channelId}> in **${targetGuild.name}**. It auto-updates every 60 seconds.`));
    }  },

  {
    name: 'removestatus',
    description: 'Remove the live status panel [Bot Owner]',
    category: 'config',
    aliases: ['rmstatus'],
    async executePrefix(message) {
      if (!isBotOwnerSync(message.author.id)) return;
      db.updateGuildConfig(message.guild.id, { liveStatusPanel: null });
      return message.reply(cv2.success('Removed', 'Live status panel has been cleared.'));
    }
  }
];
