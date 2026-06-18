import { PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import { isBotOwnerOrServerOwnerStrict, isBotOwnerSync } from '../utils/helpers.js';

const BDAY_EMOJIS = [
  '<a:cheers:1517075669547483206>',
  '<a:a_fheartSpinWhite:1516523707181433109>',
  '<a:emoji_102:1517075665281613844>',
  '<a:Star2:1516523061468205227>',
  '<a:emoji_56:1517076996121690163>'
];

export function generateBirthdayMessage(userId) {
  // Pick random emojis for each position
  const e1 = BDAY_EMOJIS[Math.floor(Math.random() * BDAY_EMOJIS.length)];
  const e2 = BDAY_EMOJIS[Math.floor(Math.random() * BDAY_EMOJIS.length)];
  const e3 = BDAY_EMOJIS[Math.floor(Math.random() * BDAY_EMOJIS.length)];

  const customEmbed = new EmbedBuilder()
    .setColor('#ff0099')
    .setDescription(
      `# ${e1} HAPPY BIRTHDAY! ${e2}\n\n` +
      `## **Hey <@${userId}>!**\n\n` +
      `### Wishing you a truly spectacular day surrounded by the people who matter most. May this special day be filled with endless joy, beautiful memories, and boundless success in everything you do. Thank you for being such an incredible part of our community. Celebrate big, because you absolutely deserve it!\n\n` +
      `## ${e3} **Have an extraordinary year ahead!**`
    );
  
  return { content: `<@${userId}>`, embeds: [customEmbed] };
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
      const isOwnerOrServerOwner = isBotOwnerOrServerOwnerStrict(message.author.id, message.guild);
      if (!isOwnerOrServerOwner) {
        return message.reply({ embeds: [embed.danger('Permission Denied', '🛡️ This command is restricted to the **Server Owner** and **Bot Owner** only.')] });
      }

      const subcommand = args[0]?.toLowerCase();

      if (subcommand === 'setchannel') {
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply({ embeds: [embed.warn('Missing Argument', 'Please mention a valid channel.')] });
        db.setBirthdayChannel(message.guild.id, channel.id);
        return message.reply({ embeds: [embed.success('Success', `Birthday wishes will now be sent to ${channel}`)] });
      }

      if (subcommand === 'set') {
        const user = message.mentions.users.first();
        const day = parseInt(args[2]);
        const month = parseInt(args[3]);

        if (!user || isNaN(day) || isNaN(month)) {
          return message.reply({ embeds: [embed.warn('Invalid Usage', 'Usage: `!birthday set @user <day> <month>`')] });
        }

        if (day < 1 || day > 31 || month < 1 || month > 12) {
          return message.reply({ embeds: [embed.warn('Invalid Date', 'Please provide a valid day (1-31) and month (1-12).')] });
        }

        db.setBirthday(message.guild.id, user.id, day, month);
        return message.reply({ embeds: [embed.success('Success', `Saved birthday for ${user} on **${day}/${month}**!`)] });
      }

      if (subcommand === 'remove') {
        const user = message.mentions.users.first();
        if (!user) return message.reply({ embeds: [embed.warn('Missing Argument', 'Please mention a valid user.')] });

        const removed = db.removeBirthday(message.guild.id, user.id);
        if (removed) {
          return message.reply({ embeds: [embed.success('Success', `Removed birthday for ${user}.`)] });
        } else {
          return message.reply({ embeds: [embed.warn('Not Found', `No birthday saved for ${user}.`)] });
        }
      }

      return message.reply({ embeds: [embed.info('Help', 'Subcommands: `setchannel #channel`, `set @user DD MM`, `remove @user`')] });
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
      
      await message.channel.send(msg);
    },
    async executeSlash(interaction) {
      return interaction.reply({ content: 'This is a prefix-only hidden command (`!testbirthday @user`).', ephemeral: true });
    }
  }
];
