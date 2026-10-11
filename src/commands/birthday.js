import { PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';
import { isBotOwnerOrServerOwnerStrict, isBotOwnerSync } from '../utils/helpers.js';

const BDAY_EMOJIS = [
  '<a:cheers:1517075669547483206>',
  '<a:a_fheartSpinWhite:1516523707181433109>',
  '<a:emoji_102:1517075665281613844>',
  '<a:Star2:1516523061468205227>',
  '<a:emoji_56:1517076996121690163>'
];

export function generateBirthdayMessage(userId, guildId) {
  // Pick random emojis for each position
  const e1 = BDAY_EMOJIS[Math.floor(Math.random() * BDAY_EMOJIS.length)];
  const e2 = BDAY_EMOJIS[Math.floor(Math.random() * BDAY_EMOJIS.length)];
  const e3 = BDAY_EMOJIS[Math.floor(Math.random() * BDAY_EMOJIS.length)];

  const guildConfig = db.getGuildConfig(guildId) || {};
  const accentColor = guildConfig.accentColor || '#ff0099';

  const customEmbed = new EmbedBuilder()
    .setColor(accentColor)
    .setDescription(
      `# ${e1} HAPPY BIRTHDAY! ${e2}\n\n` +
      `## **Hey <@${userId}>!**\n\n` +
      `### Wishing you a truly spectacular day surrounded by the people who matter most. May this special day be filled with endless joy, beautiful memories, and boundless success in everything you do. Thank you for being such an incredible part of our community. Celebrate big, because you absolutely deserve it!\n\n` +
      `## ${e3} **Have an extraordinary year ahead!**`
    );
  
  return { content: `<@${userId}>`, embeds: [customEmbed] };
}

export async function checkBirthdays(client, targetGuildId = null) {
  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const birthdayConfigs = db.cache.birthdays || {};
    let wishedCount = 0;

    for (const [guildId, config] of Object.entries(birthdayConfigs)) {
      if (targetGuildId && guildId !== targetGuildId) continue;
      if (!config.users || Object.keys(config.users).length === 0) continue;

      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) continue;

      let channel = null;
      if (config.channelId) {
        channel = guild.channels.cache.get(config.channelId) || await guild.channels.fetch(config.channelId).catch(() => null);
      }
      if (!channel) {
        channel = guild.systemChannel || guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me)?.has('SendMessages'));
      }
      if (!channel) continue;

      for (const [userId, dates] of Object.entries(config.users)) {
        if (dates.day === currentDay && dates.month === currentMonth) {
          if (dates.lastWishedYear === currentYear) {
            continue; // Already wished this year
          }

          const message = generateBirthdayMessage(userId, guildId);
          const sent = await channel.send(message).catch(err => {
            console.error(`[Birthdays] Failed to send wish in ${guild.name}:`, err);
            return null;
          });

          if (sent) {
            dates.lastWishedYear = currentYear;
            wishedCount++;
          }
        }
      }
    }

    if (wishedCount > 0) {
      db.save();
      console.log(`[Birthdays] Dispatched ${wishedCount} birthday wish(es) for ${currentDay}/${currentMonth} (IST).`);
    }
    return wishedCount;
  } catch (err) {
    console.error('[Birthdays] Error checking birthdays:', err);
    return 0;
  }
}

export const commands = [
  {
    name: 'birthday',
    description: 'Manage birthday wishing settings',
    options: [
      {
        name: 'setchannel',
        description: 'Set the channel for birthday wishes (Server/Bot Owner only)',
        type: 1, // SUB_COMMAND
        options: [
          { name: 'channel', description: 'The channel to post wishes in', type: 7, required: true }
        ]
      },
      {
        name: 'set',
        description: 'Set a birthday for a user (Server/Bot Owner only)',
        type: 1,
        options: [
          { name: 'user', description: 'The user', type: 6, required: true },
          { name: 'day', description: 'Day of the month (1-31)', type: 4, required: true },
          { name: 'month', description: 'Month of the year (1-12)', type: 4, required: true }
        ]
      },
      {
        name: 'remove',
        description: 'Remove a user\'s birthday (Server/Bot Owner only)',
        type: 1,
        options: [
          { name: 'user', description: 'The user', type: 6, required: true }
        ]
      },
      {
        name: 'list',
        description: 'List all birthdays set in the server',
        type: 1
      },
      {
        name: 'check',
        description: 'Scan and wish all pending birthdays for today immediately',
        type: 1
      },
      {
        name: 'test',
        description: 'Send a preview birthday message',
        type: 1,
        options: [
          { name: 'user', description: 'User to test with (optional)', type: 6, required: false }
        ]
      }
    ],
    async executePrefix(message, args) {
      const isOwnerOrServerOwner = isBotOwnerOrServerOwnerStrict(message.author.id, message.guild);
      if (!isOwnerOrServerOwner) {
        return message.reply(cv2.danger('Permission Denied', 'This command is restricted to the **Server Owner** and **Bot Owner** only.'));
      }

      const subcommand = args[0]?.toLowerCase();

      if (subcommand === 'setchannel') {
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply(cv2.warn('Missing Argument', 'Please mention a valid channel.'));
        db.setBirthdayChannel(message.guild.id, channel.id);
        return message.reply(cv2.success('Success', `Birthday wishes will now be sent to ${channel} <a:uptime:1552608831060844575>`));
      }

      if (subcommand === 'set') {
        const user = message.mentions.users.first();
        const day = parseInt(args[2]);
        const month = parseInt(args[3]);

        if (!user || isNaN(day) || isNaN(month)) {
          return message.reply(cv2.warn('Invalid Usage', 'Usage: `!birthday set @user <day> <month>`'));
        }

        if (day < 1 || day > 31 || month < 1 || month > 12) {
          return message.reply(cv2.warn('Invalid Date', 'Please provide a valid day (1-31) and month (1-12).'));
        }

        db.setBirthday(message.guild.id, user.id, day, month);

        const config = db.getBirthdayConfig(message.guild.id);
        const channelWarning = !config?.channelId
          ? '\n-# Note: No birthday channel is set yet. Use `!birthday setchannel #channel` to configure where wishes are sent.'
          : '';

        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const currentDay = now.getDate();
        const currentMonth = now.getMonth() + 1;

        if (day === currentDay && month === currentMonth) {
          // Immediately trigger wish for today!
          await checkBirthdays(message.client, message.guild.id);
          return message.reply(cv2.success('Birthday Saved', `Saved birthday for ${user} on **${day}/${month}**!\nSince today is their birthday, a celebration wish has been dispatched! <a:uptime:1552608831060844575>${channelWarning}`));
        }

        return message.reply(cv2.success('Birthday Saved', `Saved birthday for ${user} on **${day}/${month}**! <a:uptime:1552608831060844575>${channelWarning}`));
      }

      if (subcommand === 'remove') {
        const user = message.mentions.users.first();
        if (!user) return message.reply(cv2.warn('Missing Argument', 'Please mention a valid user.'));

        const removed = db.removeBirthday(message.guild.id, user.id);
        if (removed) {
          return message.reply(cv2.success('Success', `Removed birthday for ${user}. <a:uptime:1552608831060844575>`));
        } else {
          return message.reply(cv2.warn('Not Found', `No birthday saved for ${user}.`));
        }
      }

      if (subcommand === 'list') {
        const config = db.getBirthdayConfig(message.guild.id);
        const users = config?.users || {};
        const userIds = Object.keys(users);

        if (userIds.length === 0) {
          return message.reply(cv2.info('Birthdays', 'No birthdays have been set in this server yet.'));
        }

        const sorted = userIds.map(id => ({ id, ...users[id] })).sort((a, b) => {
          if (a.month !== b.month) return a.month - b.month;
          return a.day - b.day;
        });

        const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        let desc = '';
        sorted.forEach(u => {
          desc += `<a:Star2:1516523061468205227> <@${u.id}> — **${u.day} ${monthNames[u.month]}**\n`;
        });

        const listEmbed = new EmbedBuilder()
          .setColor(db.getGuildConfig(message.guild.id)?.accentColor || '#ff0099')
          .setTitle('<a:cheers:1517075669547483206> Server Birthdays')
          .setDescription(desc)
          .setFooter({ text: `Total Birthdays: ${userIds.length}` });

        return message.reply({ embeds: [listEmbed] });
      }

      if (subcommand === 'check') {
        const count = await checkBirthdays(message.client, message.guild.id);
        if (count > 0) {
          return message.reply(cv2.success('Birthdays Checked', `Found and wished **${count}** member(s) celebrating their birthday today! <a:uptime:1552608831060844575>`));
        } else {
          return message.reply(cv2.info('Birthdays Checked', 'No pending birthdays found for today in this server. All birthday celebrants are up to date!'));
        }
      }

      if (subcommand === 'test') {
        const targetUser = message.mentions.users.first() || message.author;
        const config = db.getBirthdayConfig(message.guild.id);
        const channel = config?.channelId ? message.guild.channels.cache.get(config.channelId) : message.channel;
        const targetChannel = channel || message.channel;
        const msg = generateBirthdayMessage(targetUser.id, message.guild.id);
        await targetChannel.send(msg);
        return message.reply(cv2.success('Test Wish Dispatched', `Sent a preview birthday wish for ${targetUser} to ${targetChannel}! <a:uptime:1552608831060844575>`));
      }

      return message.reply(cv2.info('Help', 'Subcommands: `setchannel #channel`, `set @user DD MM`, `remove @user`, `list`, `check`, `test [@user]`'));
    },
    async executeSlash(interaction) {
      const subcommand = interaction.options.getSubcommand();
      const isOwnerOrServerOwner = isBotOwnerOrServerOwnerStrict(interaction.user.id, interaction.guild);

      if (!isOwnerOrServerOwner) {
        return interaction.reply(cv2.danger('Permission Denied', 'This command is restricted to the **Server Owner** and **Bot Owner** only.'));
      }

      if (subcommand === 'setchannel') {
        const channel = interaction.options.getChannel('channel');
        db.setBirthdayChannel(interaction.guild.id, channel.id);
        return interaction.reply(cv2.success('Success', `Birthday wishes will now be sent to ${channel} <a:uptime:1552608831060844575>`));
      }

      if (subcommand === 'set') {
        const user = interaction.options.getUser('user');
        const day = interaction.options.getInteger('day');
        const month = interaction.options.getInteger('month');

        if (day < 1 || day > 31 || month < 1 || month > 12) {
          return interaction.reply(cv2.warn('Invalid Date', 'Please provide a valid day (1-31) and month (1-12).'));
        }

        db.setBirthday(interaction.guild.id, user.id, day, month);

        const config = db.getBirthdayConfig(interaction.guild.id);
        const channelWarning = !config?.channelId
          ? '\n-# Note: No birthday channel is set yet. Use `/birthday setchannel` to configure where wishes are sent.'
          : '';

        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const currentDay = now.getDate();
        const currentMonth = now.getMonth() + 1;

        if (day === currentDay && month === currentMonth) {
          await checkBirthdays(interaction.client, interaction.guild.id);
          return interaction.reply(cv2.success('Birthday Saved', `Saved birthday for ${user} on **${day}/${month}**!\nSince today is their birthday, a celebration wish has been dispatched! <a:uptime:1552608831060844575>${channelWarning}`));
        }

        return interaction.reply(cv2.success('Birthday Saved', `Saved birthday for ${user} on **${day}/${month}**! <a:uptime:1552608831060844575>${channelWarning}`));
      }

      if (subcommand === 'remove') {
        const user = interaction.options.getUser('user');
        const removed = db.removeBirthday(interaction.guild.id, user.id);
        if (removed) {
          return interaction.reply(cv2.success('Success', `Removed birthday for ${user}. <a:uptime:1552608831060844575>`));
        } else {
          return interaction.reply(cv2.warn('Not Found', `No birthday saved for ${user}.`));
        }
      }

      if (subcommand === 'list') {
        const config = db.getBirthdayConfig(interaction.guild.id);
        const users = config?.users || {};
        const userIds = Object.keys(users);

        if (userIds.length === 0) {
          return interaction.reply(cv2.info('Birthdays', 'No birthdays have been set in this server yet.'));
        }

        const sorted = userIds.map(id => ({ id, ...users[id] })).sort((a, b) => {
          if (a.month !== b.month) return a.month - b.month;
          return a.day - b.day;
        });

        const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        let desc = '';
        sorted.forEach(u => {
          desc += `<a:Star2:1516523061468205227> <@${u.id}> — **${u.day} ${monthNames[u.month]}**\n`;
        });

        const listEmbed = new EmbedBuilder()
          .setColor(db.getGuildConfig(interaction.guild.id)?.accentColor || '#ff0099')
          .setTitle('<a:cheers:1517075669547483206> Server Birthdays')
          .setDescription(desc)
          .setFooter({ text: `Total Birthdays: ${userIds.length}` });

        return interaction.reply({ embeds: [listEmbed] });
      }

      if (subcommand === 'check') {
        const count = await checkBirthdays(interaction.client, interaction.guild.id);
        if (count > 0) {
          return interaction.reply(cv2.success('Birthdays Checked', `Found and wished **${count}** member(s) celebrating their birthday today! <a:uptime:1552608831060844575>`));
        } else {
          return interaction.reply(cv2.info('Birthdays Checked', 'No pending birthdays found for today in this server. All birthday celebrants are up to date!'));
        }
      }

      if (subcommand === 'test') {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const config = db.getBirthdayConfig(interaction.guild.id);
        const channel = config?.channelId ? interaction.guild.channels.cache.get(config.channelId) : interaction.channel;
        const targetChannel = channel || interaction.channel;
        const msg = generateBirthdayMessage(targetUser.id, interaction.guild.id);
        await targetChannel.send(msg);
        return interaction.reply(cv2.success('Test Wish Dispatched', `Sent a preview birthday wish for ${targetUser} to ${targetChannel}! <a:uptime:1552608831060844575>`));
      }
    }
  },
  
  // Hidden command specifically for the Bot Owner to test the birthday message
  {
    name: 'testbirthday',
    slashHidden: true,
    description: 'Test the birthday message (Bot Owner Only)',
    hidden: true,
    async executePrefix(message, args) {
      if (!isBotOwnerSync(message.author.id)) return;
      
      const targetUser = message.mentions.users.first() || message.author;
      const msg = generateBirthdayMessage(targetUser.id, message.guild?.id);
      
      await message.channel.send(msg);
    },
    async executeSlash(interaction) {
      return interaction.reply({ content: 'This is a prefix-only hidden command (`!testbirthday @user`).' });
    }
  }
];
