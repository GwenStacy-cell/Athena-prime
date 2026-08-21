import { EmbedBuilder } from 'discord.js';
import { isBotOwnerSync } from '../utils/helpers.js';

const DM_THREATS = [
  `Watch your back.

You've been reported to Athena Prime. We know who you are, where you chat, and what you said.

Don't push it again.

- *Athena Prime*`,

  `You've been flagged.

Consider this your one and only warning. There won't be another.

- *Athena Prime Enforcement*`,

  `We see you.

Every move you make in that server is logged. You are one mistake away from consequences you won't enjoy.

Fix yourself. Now.

- *Athena Prime*`,

  `This is a formal notice.

Your behavior has been reviewed and found unacceptable. The server owner has been notified. We have been notified. You are out of chances.

Don't make us act.

- *Athena Prime Black Division*`,

  `Tread carefully.

You've been put on our radar. We don't issue second warnings. You don't want to find out what comes next.

- *Athena Prime*`,

  `You've crossed the line.

The server owner knows. Athena Prime knows. You have been documented, flagged, and marked.

Fall in line - or fall out entirely.

- *Athena Prime Command*`,

  `Last warning.

We don't explain ourselves twice. You know what you did. The server owner authorized this message personally.

Don't test what comes after it.

- *Athena Prime*`,

  `Your name is on our list now.

We don't forget. We don't forgive. And we absolutely do not tolerate whatever it is you've been pulling.

Clean it up.

- *Athena Prime*`,
];

const PUBLIC_LOG_LINES = [
  `Warning executed. File opened. Clock started.`,
  `Transmission sent. They've been made aware. The rest is on them.`,
  `Notice delivered. No acknowledgement required. No excuses accepted.`,
  `Action taken. Logged. Timestamped. Witnessed.`,
  `They've been reached. Whatever they do next is documented.`,
  `Message dispatched. Athena Prime does not follow up twice.`,
  `Sent and sealed. This conversation is now on record.`,
  `Delivered. Consequences are now their responsibility.`,
];

export const commands = [
  {
    name: 'fck',
    slashHidden: true,
    description: 'Server Owner only: Send a direct Athena Prime warning DM to a user.',
    aliases: ['fk', 'fcku'],
    hidden: true,

    async executePrefix(message, args) {
      const isServerOwner = message.guild && message.author.id === message.guild.ownerId;
      const isBotOwner = isBotOwnerSync(message.author.id);

      if (!isServerOwner && !isBotOwner) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x2b2d31)
              .setDescription('This command is for the **Server Owner** only.')
              .setFooter({ text: 'Athena Prime | Access Denied' })
          ]
        }).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
      }

      let targetUser = message.mentions.users.first();

      if (!targetUser && args[0]) {
        const targetId = args[0].replace(/[^0-9]/g, '');
        if (targetId) targetUser = await message.client.users.fetch(targetId).catch(() => null);
      }

      if (!targetUser) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff4444)
              .setDescription('Usage: `fck @user`')
          ]
        });
      }

      if (targetUser.id === message.author.id) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff9900)
              .setDescription('You cannot warn yourself.')
          ]
        });
      }

      if (targetUser.id === message.client.user.id) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x9b59b6)
              .setDescription('Nice try. I run this place.')
          ]
        });
      }

      const dmText = DM_THREATS[Math.floor(Math.random() * DM_THREATS.length)];
      const publicText = PUBLIC_LOG_LINES[Math.floor(Math.random() * PUBLIC_LOG_LINES.length)];

      const targetMember = await message.guild?.members.fetch(targetUser.id).catch(() => null);
      const targetName = targetMember?.nickname || targetUser.displayName || targetUser.username;
      const authorName = message.member?.nickname || message.author.displayName || message.author.username;

      const dmEmbed = new EmbedBuilder()
        .setColor(0xcc0000)
        .setTitle('ATHENA PRIME - OFFICIAL WARNING')
        .setDescription(dmText)
        .setFooter({ text: `Issued by: ${authorName} | ${message.guild.name}` })
        .setTimestamp();

      let dmSent = true;
      try {
        await targetUser.send({ embeds: [dmEmbed] });
      } catch {
        dmSent = false;
      }

      const publicEmbed = new EmbedBuilder()
        .setColor(0xcc0000)
        .setTitle('ATHENA PRIME - ACTION LOG')
        .addFields([
          { name: 'Target', value: `<@${targetUser.id}>`, inline: true },
          { name: 'Issued By', value: authorName, inline: true },
          { name: 'Server', value: message.guild.name, inline: true },
          {
            name: 'Delivery',
            value: dmSent
              ? '<:dark4luvontop:1533860081916182721> Warning DM delivered to target.'
              : 'Target DMs are closed. Warning filed internally.',
            inline: false
          },
          { name: 'Log', value: publicText, inline: false }
        ])
        .setFooter({ text: 'Athena Prime Enforcement Division | Confidential' })
        .setTimestamp();

      await message.reply({ embeds: [publicEmbed] });
    }
  }
];