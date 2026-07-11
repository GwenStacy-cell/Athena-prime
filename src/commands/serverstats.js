import { PermissionFlagsBits, ChannelType, ApplicationCommandOptionType } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';

export function formatServerStatChannelName(type, count, prefixEmoji = '❗', fontStyle = 'standard') {
  const fonts = {
    standard: { USERS: 'USERS', MEMBERS: 'MEMBERS', BOTS: 'BOTS' },
    bold: { USERS: '𝗨𝗦𝗘𝗥𝗦', MEMBERS: '𝗠𝗘𝗠𝗕𝗘𝗥𝗦', BOTS: '𝗕𝗢𝗧𝗦' },
    italic: { USERS: '𝘜𝘚𝘌𝘙𝘚', MEMBERS: '𝘔𝘌𝘔𝘉𝘌𝘙𝘚', BOTS: '𝘉𝘖𝘛𝘚' },
    smallcaps: { USERS: 'ᴜsᴇʀs', MEMBERS: 'ᴍᴇᴍʙᴇʀs', BOTS: 'ʙᴏᴛs' },
    serif: { USERS: '𝐔𝐒𝐄𝐑𝐒', MEMBERS: '𝐌𝐄𝐌𝐁𝐄𝐑𝐒', BOTS: '𝐁𝐎𝐓𝐒' },
    script: { USERS: '𝓤𝓢𝓔𝓡𝓢', MEMBERS: '𝓜𝓔𝓜𝓑𝓔𝓡𝓢', BOTS: '𝓑𝓞𝓣𝓢' },
    gothic: { USERS: '𝔘𝔖𝔈ℜ𝔖', MEMBERS: '𝔐𝔈𝔐𝔅𝔈ℜ𝔖', BOTS: '𝔅𝔒𝔗𝔖' },
    mono: { USERS: 'ＵＳＥＲＳ', MEMBERS: 'ＭＥＭＢＥＲＳ', BOTS: 'ＢＯＴＳ' }
  };
  
  const selectedFont = fonts[fontStyle.toLowerCase()] || fonts.standard;
  const word = selectedFont[type] || fonts.standard[type];
  
  return `${prefixEmoji}・${word}: ${count}`;
}

export const commands = [
  {
    name: 'serverstats',
    description: 'Manage server stats voice channels',
    permissions: [PermissionFlagsBits.Administrator],
    category: 'utility',
    options: [
      {
        name: 'setup',
        description: 'Create live auto-updating Member Count VCs',
        type: 1 // SUB_COMMAND
      },
      {
        name: 'config',
        description: 'Configure the font and emoji prefix for server stats',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'emoji',
            description: 'The emoji prefix to use (e.g. 📊 or custom emoji)',
            type: ApplicationCommandOptionType.String,
            required: false
          },
          {
            name: 'font',
            description: 'The font style to use',
            type: ApplicationCommandOptionType.String,
            required: false,
            choices: [
              { name: 'Standard', value: 'standard' },
              { name: 'Bold', value: 'bold' },
              { name: 'Small Caps', value: 'smallcaps' },
              { name: 'Serif', value: 'serif' },
              { name: 'Script', value: 'script' },
              { name: 'Gothic', value: 'gothic' },
              { name: 'Monospace', value: 'mono' }
            ]
          }
        ]
      },
      {
        name: 'disable',
        description: 'Disable and delete the Server Stats channels',
        type: 1 // SUB_COMMAND
      }
    ],
    aliases: ['statsetup', 'serverstat', 'statsconfig'],
    executePrefix: async (message, args) => {
      const action = args[0]?.toLowerCase();
      
      if (action === 'disable') {
        const stats = db.getServerStats(message.guild.id);
        if (!stats) return message.reply({ embeds: [embed.warning('Not Setup', 'Server stats are not currently set up.')] });
        
        const m = await message.reply(' Disabling server stats and deleting channels...');
        
        for (const id of [stats.categoryId, stats.totalId, stats.humansId, stats.botsId]) {
          const ch = message.guild.channels.cache.get(id);
          if (ch) await ch.delete().catch(() => null);
        }
        
        db.deleteServerStats(message.guild.id);
        return m.edit({ content: '', embeds: [embed.success('Disabled', 'Server stats channels have been deleted.')] });
      }
      
      if (action === 'config') {
        const stats = db.getServerStats(message.guild.id);
        if (!stats) return message.reply({ embeds: [embed.warning('Not Setup', 'Server stats are not currently set up. Please run `!serverstats setup` first.')] });
        
        let newEmoji = args[1];
        let newFont = args[2]?.toLowerCase();
        
        // Handle if user only provided font
        const validFonts = ['standard', 'bold', 'italic', 'smallcaps', 'serif', 'script', 'gothic', 'mono'];
        if (args[1] && validFonts.includes(args[1].toLowerCase())) {
          newFont = args[1].toLowerCase();
          newEmoji = undefined;
        }

        if (!newEmoji && !newFont) {
           return message.reply({ embeds: [embed.info('Config Usage', 'Usage: `!serverstats config <emoji> <font>`\nExample: `!serverstats config 📊 bold`\nAvailable fonts: `standard, bold, smallcaps, serif, script, gothic, mono`')] });
        }

        const updatedStats = { ...stats };
        if (newEmoji) updatedStats.emoji = newEmoji;
        if (newFont) updatedStats.font = newFont;
        
        db.saveServerStats(message.guild.id, updatedStats);
        
        // Trigger manual update right away
        await message.guild.members.fetch().catch(() => null);
        const total = message.guild.memberCount;
        const bots = message.guild.members.cache.filter(member => member.user.bot).size;
        const humans = total - bots;
        
        const totalCh = message.guild.channels.cache.get(stats.totalId);
        const humansCh = message.guild.channels.cache.get(stats.humansId);
        const botsCh = message.guild.channels.cache.get(stats.botsId);
        
        const e = updatedStats.emoji || '❗';
        const f = updatedStats.font || 'standard';

        if (totalCh) await totalCh.setName(formatServerStatChannelName('USERS', total, e, f)).catch(() => null);
        if (humansCh) await humansCh.setName(formatServerStatChannelName('MEMBERS', humans, e, f)).catch(() => null);
        if (botsCh) await botsCh.setName(formatServerStatChannelName('BOTS', bots, e, f)).catch(() => null);

        return message.reply({ embeds: [embed.success('Stats Configured', `Server stats font/emoji updated to **${f}** with emoji **${e}**!`)] });
      }

      if (action === 'setup') {
        const m = await message.reply(' Setting up server stats channels. This may take a moment...');
        
        // Count members
        await message.guild.members.fetch().catch(() => null);
        const total = message.guild.memberCount;
        const bots = message.guild.members.cache.filter(member => member.user.bot).size;
        const humans = total - bots;
        
        // Deny connect to everyone
        const permissionOverwrites = [
          {
            id: message.guild.id, // @everyone
            deny: [PermissionFlagsBits.Connect],
            allow: [PermissionFlagsBits.ViewChannel]
          }
        ];
        
        try {
          const category = await message.guild.channels.create({
            name: 'SERVER STATS',
            type: ChannelType.GuildCategory
          });
          
          const totalCh = await message.guild.channels.create({
            name: formatServerStatChannelName('USERS', total),
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites
          });
          
          const humansCh = await message.guild.channels.create({
            name: formatServerStatChannelName('MEMBERS', humans),
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites
          });
          
          const botsCh = await message.guild.channels.create({
            name: formatServerStatChannelName('BOTS', bots),
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites
          });
          
          db.saveServerStats(message.guild.id, {
            categoryId: category.id,
            totalId: totalCh.id,
            humansId: humansCh.id,
            botsId: botsCh.id,
            emoji: '❗',
            font: 'standard'
          });
          
          return m.edit({ content: '', embeds: [embed.success('Setup Complete', 'Server stats channels have been created and will automatically update every 6 minutes!')] });
        } catch (err) {
          console.error(err);
          return m.edit({ content: '', embeds: [embed.danger('Error', 'Failed to create channels. Ensure the bot has `Manage Channels` permission.')] });
        }
      }
      
      return message.reply({ embeds: [embed.info('Server Stats', 'Usage: `!serverstats setup`, `!serverstats disable`, or `!serverstats config <emoji> <font>`')] });
    },
    executeSlash: async (interaction) => {
      await interaction.deferReply();
      const action = interaction.options.getSubcommand();
      
      if (action === 'disable') {
        const stats = db.getServerStats(interaction.guild.id);
        if (!stats) return interaction.editReply({ embeds: [embed.warning('Not Setup', 'Server stats are not currently set up.')] });
        
        for (const id of [stats.categoryId, stats.totalId, stats.humansId, stats.botsId]) {
          const ch = interaction.guild.channels.cache.get(id);
          if (ch) await ch.delete().catch(() => null);
        }
        
        db.deleteServerStats(interaction.guild.id);
        return interaction.editReply({ embeds: [embed.success('Disabled', 'Server stats channels have been deleted.')] });
      }
      
      if (action === 'config') {
        const stats = db.getServerStats(interaction.guild.id);
        if (!stats) return interaction.editReply({ embeds: [embed.warning('Not Setup', 'Server stats are not currently set up.')] });
        
        const newEmoji = interaction.options.getString('emoji');
        const newFont = interaction.options.getString('font');
        
        if (!newEmoji && !newFont) {
           return interaction.editReply({ embeds: [embed.info('No Changes', 'You must provide either an emoji or a font to configure.')] });
        }

        const updatedStats = { ...stats };
        if (newEmoji) updatedStats.emoji = newEmoji;
        if (newFont) updatedStats.font = newFont;
        
        db.saveServerStats(interaction.guild.id, updatedStats);
        
        // Trigger manual update right away
        await interaction.guild.members.fetch().catch(() => null);
        const total = interaction.guild.memberCount;
        const bots = interaction.guild.members.cache.filter(member => member.user.bot).size;
        const humans = total - bots;
        
        const totalCh = interaction.guild.channels.cache.get(stats.totalId);
        const humansCh = interaction.guild.channels.cache.get(stats.humansId);
        const botsCh = interaction.guild.channels.cache.get(stats.botsId);
        
        const e = updatedStats.emoji || '❗';
        const f = updatedStats.font || 'standard';

        if (totalCh) await totalCh.setName(formatServerStatChannelName('USERS', total, e, f)).catch(() => null);
        if (humansCh) await humansCh.setName(formatServerStatChannelName('MEMBERS', humans, e, f)).catch(() => null);
        if (botsCh) await botsCh.setName(formatServerStatChannelName('BOTS', bots, e, f)).catch(() => null);

        return interaction.editReply({ embeds: [embed.success('Stats Configured', `Server stats font/emoji updated to **${f}** with emoji **${e}**!`)] });
      }

      if (action === 'setup') {
        await interaction.guild.members.fetch().catch(() => null);
        const total = interaction.guild.memberCount;
        const bots = interaction.guild.members.cache.filter(member => member.user.bot).size;
        const humans = total - bots;
        
        const permissionOverwrites = [
          {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.Connect],
            allow: [PermissionFlagsBits.ViewChannel]
          }
        ];
        
        try {
          const category = await interaction.guild.channels.create({
            name: 'SERVER STATS',
            type: ChannelType.GuildCategory
          });
          
          const totalCh = await interaction.guild.channels.create({
            name: formatServerStatChannelName('USERS', total),
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites
          });
          
          const humansCh = await interaction.guild.channels.create({
            name: formatServerStatChannelName('MEMBERS', humans),
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites
          });
          
          const botsCh = await interaction.guild.channels.create({
            name: formatServerStatChannelName('BOTS', bots),
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites
          });
          
          db.saveServerStats(interaction.guild.id, {
            categoryId: category.id,
            totalId: totalCh.id,
            humansId: humansCh.id,
            botsId: botsCh.id,
            emoji: '❗',
            font: 'standard'
          });
          
          return interaction.editReply({ embeds: [embed.success('Setup Complete', 'Server stats channels have been created and will automatically update every 6 minutes!')] });
        } catch (err) {
          console.error(err);
          return interaction.editReply({ embeds: [embed.danger('Error', 'Failed to create channels. Ensure the bot has `Manage Channels` permission.')] });
        }
      }
    }
  }
];
