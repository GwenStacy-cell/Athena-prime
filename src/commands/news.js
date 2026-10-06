import { PermissionFlagsBits, ChannelType } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';
import Parser from 'rss-parser';

const parser = new Parser();

export const commands = [
  {
    name: 'news',
    description: 'Configure automated RSS News Feeds for your server.',
    category: 'utility',
    permissions: [PermissionFlagsBits.ManageGuild],
    options: [
      {
        name: 'setup',
        description: 'Set up the channel and role for automated news feeds.',
        type: 1, 
        options: [
          {
            name: 'channel',
            description: 'The channel where news articles will be posted.',
            type: 7, 
            channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
            required: true
          },
          {
            name: 'ping_role',
            description: 'Optionally select an existing role to ping.',
            type: 8, 
            required: false
          },
          {
            name: 'create_role',
            description: 'Should I create a news alert role automatically?',
            type: 5, 
            required: false
          }
        ]
      },
      {
        name: 'add',
        description: 'Add a new RSS feed.',
        type: 1,
        options: [
          {
            name: 'preset',
            description: 'Choose a reputable pre-configured news source.',
            type: 3, 
            required: false,
            choices: [
              { name: 'BBC World News', value: 'BBC|http://feeds.bbci.co.uk/news/world/rss.xml' },
              { name: 'BBC Technology', value: 'BBC Tech|http://feeds.bbci.co.uk/news/technology/rss.xml' },
              { name: 'Al Jazeera English', value: 'Al Jazeera|https://www.aljazeera.com/xml/rss/all.xml' },
              { name: 'CNN Top Stories', value: 'CNN|http://rss.cnn.com/rss/edition.rss' }
            ]
          },
          {
            name: 'custom_url',
            description: 'Provide a direct URL to a valid RSS XML feed.',
            type: 3, 
            required: false
          }
        ]
      },
      {
        name: 'remove',
        description: 'Remove an existing RSS feed.',
        type: 1,
        options: [
          {
            name: 'url',
            description: 'The URL of the feed to remove. Use /news list to see active URLs.',
            type: 3, 
            required: true,
            autocomplete: true
          }
        ]
      },
      {
        name: 'list',
        description: 'List all currently active news feeds.',
        type: 1
      },
      {
        name: 'disable',
        description: 'Disable the news system and delete all saved configurations.',
        type: 1
      }
    ],

    async autocomplete(interaction) {
      if (interaction.options.getSubcommand() === 'remove') {
        const config = db.getNewsConfig(interaction.guild.id);
        const feeds = config.feeds || [];
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices = feeds.map(f => ({ name: `${f.name} - ${f.url}`.substring(0, 100), value: f.url }));
        const filtered = choices.filter(c => c.name.toLowerCase().includes(focusedValue));
        await interaction.respond(filtered.slice(0, 25));
      }
    },

    async executePrefix(message, args) {
      return message.reply(cv2.warn('Slash Command Only', 'Please use the `/news` slash command to configure the news feed.'));
    },

    async executeSlash(interaction) {
      const subCommand = interaction.options.getSubcommand();
      
      if (subCommand === 'setup') {
        const channel = interaction.options.getChannel('channel');
        let role = interaction.options.getRole('ping_role');
        const createRole = interaction.options.getBoolean('create_role');

        if (!role && createRole) {
          try {
            const guildConfig = db.getGuildConfig(interaction.guild.id);
            const color = guildConfig.accentColor || '#3498db';
            role = await interaction.guild.roles.create({ name: 'News Alerts', color: color, mentionable: false, reason: 'Role for automated News Feed mentions' });
          } catch (err) {
            return interaction.reply(cv2.danger('Permission Error', 'I lack the "Manage Roles" permission to dynamically create a news ping role.'));
          }
        }
        
        db.setNewsSetup(interaction.guild.id, channel.id, role ? role.id : null);
        
        let desc = `Successfully configured the news feed system!\n**Channel:** <#${channel.id}>\n`;
        if (role) desc += `**Ping Role:** <@&${role.id}>`;
        else desc += `**Ping Role:** None`;
        
        return interaction.reply(cv2.success('News Feed Configured', desc));
      }

      if (subCommand === 'disable') {
        const config = db.getNewsConfig(interaction.guild.id);
        if (!config || (!config.channelId && (!config.feeds || config.feeds.length === 0))) {
          return interaction.reply(cv2.info('Not Configured', 'The news feed system is not currently active on this server.'));
        }
        
        db.setNewsSetup(interaction.guild.id, null, null);
        if (db.cache.newsFeeds[interaction.guild.id]) {
           db.cache.newsFeeds[interaction.guild.id] = { channelId: null, roleId: null, feeds: [] };
        }
        db.updateNewsGuids(interaction.guild.id, []);
        
        return interaction.reply(cv2.success('System Disabled', 'The news feed system has been disabled and all presets have been deleted.'));
      }

      const config = db.getNewsConfig(interaction.guild.id);
      if (!config.channelId) {
        return interaction.reply(cv2.warn('Setup Required', 'You must run `/news setup` before managing feeds.'));
      }

      if (subCommand === 'add') {
        const preset = interaction.options.getString('preset');
        const custom = interaction.options.getString('custom_url');

        if (!preset && !custom) {
          return interaction.reply(cv2.warn('Missing Input', 'You must provide either a preset or a custom URL.'));
        }

        let name, url;
        if (preset) {
          const parts = preset.split('|');
          name = parts[0];
          url = parts[1];
        } else {
          url = custom;
          name = new URL(url).hostname; 
        }

        await interaction.deferReply();

        try {
          const feed = await parser.parseURL(url);
          name = feed.title || name;
          
          if (!config.feeds) config.feeds = [];
          if (config.feeds.length >= 5) {
            return interaction.editReply(cv2.warn('Limit Reached', 'You can only have up to 5 news feeds per server.'));
          }
          
          if (config.feeds.find(f => f.url === url)) {
            return interaction.editReply(cv2.warn('Duplicate Feed', 'This server is already subscribed to this exact feed URL.'));
          }

          db.addNewsFeed(interaction.guild.id, { name, url });
          return interaction.editReply(cv2.success('Feed Added', `Successfully subscribed to **${name}**.\n\nURL: \`${url}\``));
        } catch (err) {
          return interaction.editReply(cv2.danger('Invalid RSS Feed', `Failed to parse the provided URL. Make sure it is a valid XML RSS Feed.\n\nError: \`${err.message}\``));
        }
      }

      if (subCommand === 'remove') {
        const url = interaction.options.getString('url');
        const feeds = config.feeds || [];
        const index = feeds.findIndex(f => f.url === url);
        
        if (index === -1) {
          return interaction.reply(cv2.warn('Not Found', 'Could not find an active feed with that URL.'));
        }

        feeds.splice(index, 1);
        db.cache.newsFeeds[interaction.guild.id].feeds = feeds;
        // The file database.js doesn't have removeNewsFeed, but we just mutated the cache directly.
        // Let's force a save by updating the whole setup or writing directly.
        // Actually, updateNewsGuids modifies the config, let's just re-save it.
        const c = db.getNewsConfig(interaction.guild.id);
        db.updateGuildConfig(interaction.guild.id, { newsFeeds: c });
        
        return interaction.reply(cv2.success('Feed Removed', `Successfully removed feed: \`${url}\``));
      }

      if (subCommand === 'list') {
        const feeds = config.feeds || [];
        if (feeds.length === 0) {
          return interaction.reply(cv2.info('No Feeds', 'This server is not currently subscribed to any news feeds.'));
        }

        const feedList = feeds.map((f, i) => `**${i+1}. ${f.name}**\n<${f.url}>`).join('\n\n');
        return interaction.reply(cv2.info('Active News Feeds', feedList));
      }
    }
  }
];
