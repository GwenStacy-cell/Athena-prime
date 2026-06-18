import { PermissionFlagsBits, ChannelType } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';

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
        name: 'disable',
        description: 'Disable and delete the Server Stats channels',
        type: 1 // SUB_COMMAND
      }
    ],
    aliases: ['statsetup', 'stats'],
    executePrefix: async (message, args) => {
      const action = args[0]?.toLowerCase();
      
      if (action === 'disable') {
        const stats = db.getServerStats(message.guild.id);
        if (!stats) return message.reply({ embeds: [embed.warning('Not Setup', 'Server stats are not currently set up.')] });
        
        const m = await message.reply('⏳ Disabling server stats and deleting channels...');
        
        for (const id of [stats.categoryId, stats.totalId, stats.humansId, stats.botsId]) {
          const ch = message.guild.channels.cache.get(id);
          if (ch) await ch.delete().catch(() => null);
        }
        
        db.deleteServerStats(message.guild.id);
        return m.edit({ content: '', embeds: [embed.success('Disabled', 'Server stats channels have been deleted.')] });
      }
      
      if (action === 'setup') {
        const m = await message.reply('⏳ Setting up server stats channels. This may take a moment...');
        
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
            name: `❗・USERS: ${total}`,
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites
          });
          
          const humansCh = await message.guild.channels.create({
            name: `❗・MEMBERS: ${humans}`,
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites
          });
          
          const botsCh = await message.guild.channels.create({
            name: `❗・BOTS: ${bots}`,
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites
          });
          
          db.saveServerStats(message.guild.id, {
            categoryId: category.id,
            totalId: totalCh.id,
            humansId: humansCh.id,
            botsId: botsCh.id
          });
          
          return m.edit({ content: '', embeds: [embed.success('Setup Complete', 'Server stats channels have been created and will automatically update every 6 minutes!')] });
        } catch (err) {
          console.error(err);
          return m.edit({ content: '', embeds: [embed.danger('Error', 'Failed to create channels. Ensure the bot has `Manage Channels` permission.')] });
        }
      }
      
      return message.reply({ embeds: [embed.info('Server Stats', 'Usage: `!serverstats setup` or `!serverstats disable`')] });
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
            name: `❗・USERS: ${total}`,
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites
          });
          
          const humansCh = await interaction.guild.channels.create({
            name: `❗・MEMBERS: ${humans}`,
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites
          });
          
          const botsCh = await interaction.guild.channels.create({
            name: `❗・BOTS: ${bots}`,
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites
          });
          
          db.saveServerStats(interaction.guild.id, {
            categoryId: category.id,
            totalId: totalCh.id,
            humansId: humansCh.id,
            botsId: botsCh.id
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
