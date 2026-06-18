import { PermissionFlagsBits, ChannelType } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import { isBotOwnerOrServerOwnerStrict, isBotOwnerSync } from '../utils/helpers.js';

const EMOJIS = [
  '<a:emoji_114:1516523064492425318>',
  '<a:crown:1445649249143357541>',
  '<a:emoji_54:1417775717323636796>',
  '<a:1226212822073999360:1513488972083363911>',
  '<a:1436221846331723918:1514205977770065961>',
  '<a:1498932004442341436:1513489569767493663>',
  '<a:Dark4luvontop:1462126038753476629>'
];

export function getRandomBirthdayEmojis() {
  const shuffled = [...EMOJIS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.floor(Math.random() * 3) + 2).join(' '); // 2 to 4 emojis
}

export function generateBirthdayMessage(userId) {
  const e1 = getRandomBirthdayEmojis();
  const e2 = getRandomBirthdayEmojis();
  
  return `${e1} \n\n# **HAPPY BIRTHDAY <@${userId}>!** \n\n### Wishing you a fantastic day filled with joy, love, and countless blessings. May all your dreams come true! \n\n${e2}`;
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
      }
    ],
    async executePrefix(message, args) {
      return message.reply({ embeds: [embed.info('Slash Command Only', 'Please use the `/birthday` slash command for this feature.')] });
    },
    async executeSlash(interaction) {
      const subcommand = interaction.options.getSubcommand();
      const isOwnerOrServerOwner = isBotOwnerOrServerOwnerStrict(interaction.user.id, interaction.guild);

      if (!isOwnerOrServerOwner) {
        return interaction.reply({ embeds: [embed.danger('Permission Denied', '🛡️ This command is restricted to the **Server Owner** and **Bot Owner** only.')], ephemeral: true });
      }

      if (subcommand === 'setchannel') {
        const channel = interaction.options.getChannel('channel');
        db.setBirthdayChannel(interaction.guild.id, channel.id);
        return interaction.reply({ embeds: [embed.success('Success', `Birthday wishes will now be sent to ${channel}`)], ephemeral: true });
      }

      if (subcommand === 'set') {
        const user = interaction.options.getUser('user');
        const day = interaction.options.getInteger('day');
        const month = interaction.options.getInteger('month');

        if (day < 1 || day > 31 || month < 1 || month > 12) {
          return interaction.reply({ embeds: [embed.warn('Invalid Date', 'Please provide a valid day (1-31) and month (1-12).')], ephemeral: true });
        }

        db.setBirthday(interaction.guild.id, user.id, day, month);
        return interaction.reply({ embeds: [embed.success('Success', `Saved birthday for ${user} on **${day}/${month}**!`)], ephemeral: true });
      }

      if (subcommand === 'remove') {
        const user = interaction.options.getUser('user');
        const removed = db.removeBirthday(interaction.guild.id, user.id);
        if (removed) {
          return interaction.reply({ embeds: [embed.success('Success', `Removed birthday for ${user}.`)], ephemeral: true });
        } else {
          return interaction.reply({ embeds: [embed.warn('Not Found', `No birthday saved for ${user}.`)], ephemeral: true });
        }
      }
    }
  },
  
  // Hidden command specifically for the Bot Owner to test the birthday message
  {
    name: 'testbirthday',
    description: 'Test the birthday message (Bot Owner Only)',
    hidden: true, // Hides from global slash commands so only Bot Owner knows it exists
    async executePrefix(message, args) {
      if (!isBotOwnerSync(message.author.id)) return; // Completely ignore if not bot owner
      
      const targetUser = message.mentions.users.first() || message.author;
      const msg = generateBirthdayMessage(targetUser.id);
      
      await message.channel.send({ content: msg });
    },
    async executeSlash(interaction) {
      return interaction.reply({ content: 'This is a prefix-only hidden command (`!testbirthday @user`).', ephemeral: true });
    }
  }
];
