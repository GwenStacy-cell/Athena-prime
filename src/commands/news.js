import { PermissionFlagsBits, ChannelType } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
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
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'channel',
            description: 'The channel where news articles will be posted.',
            type: 7, // CHANNEL
            channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
            required: true
          },
          {
            name: 'ping_role',
            description: 'Optionally select an existing role to ping (or leave blank to have the bot create one).',
            type: 8, // ROLE
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
            type: 3, // STRING
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
            type: 3, // STRING
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
            type: 3, // STRING
            required: true
          }
        ]
      },
      {
        name: 'list',
        description: 'List all currently active news feeds.',
        type: 1
      }
    ],

    async executePrefix(message, args) {
      return message.reply({ embeds: [embed.warn('Slash Command Only', 'Please use the \`/news\` slash command to configure the news feed.')] });
    },

    async executeSlash(interaction) {
      const subCommand = interaction.options.getSubcommand();
      
      if (subCommand === 'setup') {
        const channel = interaction.options.getChannel('channel');
        let role = interaction.options.getRole('ping_role');

        if (!role) {
          // Create the role
          try {
            role = await interaction.guild.roles.create({
              name: 'News Alerts',
              color: '#3498db',
              mentionable: false,
              reason: 'Role for automated News Feed mentions'
            });
          } catch (err) {
            return interaction.reply({ embeds: [embed.danger('Permission Error', 'I lack the "Manage Roles" permission to dynamically create a news ping role. Please create one manually and provide it, or give me Manage Roles.')], ephemeral: true });
          }
        }

        db.setNewsSetup(interaction.guild.id, channel.id, role.id);

        return interaction.reply({ embeds: [embed.success('News Feed Setup', `Successfully configured news to be sent to ${channel}.\n\nPing Role: ${role}\n*(You can rename or change the color of this role at any time in server settings)*.\n\nNow use \`/news add\` to subscribe to a feed!`)] });
      }

      if (subCommand === 'add') {
        const preset = interaction.options.getString('preset');
        const customUrl = interaction.options.getString('custom_url');

        if (!preset && !customUrl) {
          return interaction.reply({ embeds: [embed.warn('Missing Input', 'You must select a preset source OR provide a custom RSS URL.')], ephemeral: true });
        }

        let name = 'Custom Feed';
        let url = customUrl;

        if (preset) {
          const parts = preset.split('|');
          name = parts[0];
          url = parts[1];
        }

        await interaction.deferReply();

        try {
          // Validate the feed
          const feed = await parser.parseURL(url);
          name = feed.title || name;

          const added = db.addNewsFeed(interaction.guild.id, name, url);
          if (added) {
            return interaction.editReply({ embeds: [embed.success('Feed Added', `Successfully subscribed to **${name}**.\n\nURL: \`${url}\``)] });
          } else {
            return interaction.editReply({ embeds: [embed.warn('Duplicate Feed', 'This server is already subscribed to this exact feed URL.')] });
          }
        } catch (err) {
          return interaction.editReply({ embeds: [embed.danger('Invalid RSS Feed', `Failed to parse the provided URL. Make sure it is a valid XML RSS Feed.\n\nError: \`${err.message}\``)] });
        }
      }

      if (subCommand === 'remove') {
        const url = interaction.options.getString('url');
        const removed = db.removeNewsFeed(interaction.guild.id, url);

        if (removed) {
          return interaction.reply({ embeds: [embed.success('Feed Removed', `Successfully unsubscribed from \`${url}\`.`)] });
        } else {
          return interaction.reply({ embeds: [embed.warn('Not Found', 'Could not find a feed matching that exact URL. Use \`/news list\` to check your active URLs.')], ephemeral: true });
        }
      }

      if (subCommand === 'list') {
        const cfg = db.getNewsConfig(interaction.guild.id);
        
        if (!cfg.feeds || cfg.feeds.length === 0) {
          return interaction.reply({ embeds: [embed.info('Active Feeds', 'This server is not subscribed to any news feeds yet.')] });
        }

        const lines = cfg.feeds.map((f, i) => `**${i + 1}. ${f.name}**\nURL: \`${f.url}\``).join('\n\n');
        
        let header = '';
        if (cfg.channelId) header += `**Channel:** <#${cfg.channelId}>\n`;
        if (cfg.roleId) header += `**Ping Role:** <@&${cfg.roleId}>\n`;
        
        return interaction.reply({ embeds: [embed.info('Active Feeds', `${header}\n${lines}`)] });
      }
    }
  }
];
