import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ApplicationCommandOptionType
} from 'discord.js';
import embed from '../embed.js';
import db from '../database.js';
import { isBotOwnerSync } from '../utils/helpers.js';

// ==========================================
// SPAM MORE CACHE
// key: customId -> { text, targetUserId | channelId, mode, requesterId }
// mode: 'user_dm' | 'channel'
// Auto-expires after 10 minutes
// ==========================================
export const spamMoreCache = new Map();

export const commands = [

  // ─────────────────────────────────────────
  // SPAM — Spam a user's DM or the current channel
  // Usage:
  //   !spam @user <message>      → spams target user's DM
  //   !spam <message>            → spams current channel anonymously
  //   /spam user:@user message:  → spams target user's DM
  //   /spam message:             → spams current channel anonymously
  // ─────────────────────────────────────────
  {
    name: 'spam',
    description: ' Spam a user\'s DM or current channel. (Permitted users only)',
    category: 'owner',
    hidden: false,
    permissions: [],
    options: [
      {
        name: 'target',
        description: 'User to spam in DMs (leave empty to spam current channel)',
        type: ApplicationCommandOptionType.User,
        required: false
      },
      {
        name: 'message',
        description: 'Message to spam',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'count',
        description: 'How many times (1-10, default 5)',
        type: ApplicationCommandOptionType.Integer,
        required: false,
        min_value: 1,
        max_value: 10
      }
    ],

    async executePrefix(message, args) {
      const userId = message.author.id;
      if (!isBotOwnerSync(userId) && !db.isSpamPermitted(userId)) return;

      // Parse: first arg could be @mention (target user) or start of message
      let targetUser = message.mentions.users.first() || null;
      let text;
      let count = 5;

      if (targetUser) {
        // !spam @user [count] <message>
        let remaining = args.slice(1); // skip the mention
        // Check if second arg is a number (count)
        if (remaining[0] && /^\d+$/.test(remaining[0])) {
          count = Math.min(Math.max(parseInt(remaining[0]), 1), 10);
          remaining = remaining.slice(1);
        }
        text = remaining.join(' ').trim();
      } else {
        // !spam [count] <message>  — no target, spam current channel
        if (args[0] && /^\d+$/.test(args[0])) {
          count = Math.min(Math.max(parseInt(args[0]), 1), 10);
          text = args.slice(1).join(' ').trim();
        } else {
          text = args.join(' ').trim();
        }
      }

      if (!text) {
        return message.reply({
          embeds: [embed.warn('Spam Usage',
            `${message.author}  **Spam a user's DM:**\n\`!spam @user [count] <message>\`\n\n` +
            `**Spam current channel:**\n\`!spam [count] <message>\`\n\n` +
            `Count defaults to 5 (max 10).`
          )]
        }).catch(() => null);
      }

      // Delete trigger message in guild for anonymity
      if (message.guild) await message.delete().catch(() => null);

      if (targetUser) {
        // Spam target user's DM
        const result = await spamUserDm(message.client, targetUser.id, text, count, userId);
        // Button goes in the channel where command was run
        const row = buildSpamMoreRow(userId, null, targetUser.id, text, 'user_dm');
        await message.channel.send({
          embeds: [result.success
            ? embed.success('DM Spam Deployed ', `Spammed **${targetUser.tag}**'s DM with your message **${count}x**.`)
            : embed.warn('DM Spam Failed', result.message)
          ],
          components: result.success ? [row] : []
        }).catch(() => null);
      } else {
        // Spam current channel via webhook
        await executeChannelSpam(message.channel, text, count);
        const row = buildSpamMoreRow(userId, message.channel.id, null, text, 'channel');
        await message.channel.send({
          embeds: [embed.success('Channel Spam Deployed ', `Message sent **${count}x** anonymously in this channel.`)],
          components: [row]
        }).catch(() => null);
      }
    },

    async executeSlash(interaction) {
      const userId = interaction.user.id;
      if (!isBotOwnerSync(userId) && !db.isSpamPermitted(userId)) {
        return interaction.reply({ embeds: [embed.danger('Access Denied', ' You do not have permission to use this command.')], flags: 64 });
      }

      const targetUser = interaction.options.getUser('target') || null;
      const text = interaction.options.getString('message');
      const count = interaction.options.getInteger('count') || 5;

      if (!text) {
        // Show modal
        const modal = new ModalBuilder()
          .setCustomId(`spam_modal_${interaction.user.id}`)
          .setTitle(' Spam Manager');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('spam_message')
              .setLabel('Message to spam')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('Type your message...')
              .setRequired(true)
              .setMaxLength(1000)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('spam_count')
              .setLabel('How many times? (1-10)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('5')
              .setRequired(false)
              .setMaxLength(2)
          )
        );
        return interaction.showModal(modal);
      }

      await interaction.deferReply({ flags: 64 });

      if (targetUser) {
        const result = await spamUserDm(interaction.client, targetUser.id, text, count, userId);
        const row = buildSpamMoreRow(userId, null, targetUser.id, text, 'user_dm');
        await interaction.editReply({
          embeds: [result.success
            ? embed.success('DM Spam Deployed ', `Spammed **${targetUser.tag}**'s DM **${count}x**.`)
            : embed.warn('DM Spam Failed', result.message)
          ],
          components: result.success ? [row] : []
        });
      } else {
        await executeChannelSpam(interaction.channel, text, count);
        const row = buildSpamMoreRow(userId, interaction.channel.id, null, text, 'channel');
        await interaction.editReply({
          embeds: [embed.success('Channel Spam Deployed ', `Message sent **${count}x** anonymously.`)],
          components: [row]
        });
      }
    }
  },

  // ─────────────────────────────────────────
  // SPAMPERMIT
  // ─────────────────────────────────────────
  {
    name: 'spampermit',
    description: ' Grant a user permission to use the spam command. (Bot Owner only)',
    category: 'owner',
    hidden: true,
    permissions: [],
    options: [
      {
        name: 'userid',
        description: 'The Discord User ID to permit',
        type: ApplicationCommandOptionType.String,
        required: true
      }
    ],

    async executePrefix(message, args) {
      if (!isBotOwnerSync(message.author.id)) return;

      const targetId = args[0]?.replace(/\D/g, '');
      if (!targetId || targetId.length < 17) {
        return message.reply({ embeds: [embed.warn('Usage Error', `${message.author} **Usage:** \`spampermit <userId or @mention>\``)] });
      }

      const added = db.addSpamPermit(targetId);
      let userTag = `\`${targetId}\``;
      try { const u = await message.client.users.fetch(targetId); userTag = `**${u.tag}**`; } catch { /* skip */ }

      return message.reply({ embeds: [
        added
          ? embed.success('Spam Access Granted', `${message.author}  ${userTag} can now use the spam command.`)
          : embed.warn('Already Permitted', `${message.author} That user already has spam access.`)
      ]});
    },

    async executeSlash(interaction) {
      if (!isBotOwnerSync(interaction.user.id)) {
        return interaction.reply({ embeds: [embed.danger('Access Denied', ' Only the Bot Owner can do this.')], flags: 64 });
      }
      const targetId = interaction.options.getString('userid').replace(/\D/g, '');
      if (!targetId || targetId.length < 17) {
        return interaction.reply({ embeds: [embed.warn('Invalid ID', 'Provide a valid User ID.')], flags: 64 });
      }
      const added = db.addSpamPermit(targetId);
      let userTag = `\`${targetId}\``;
      try { const u = await interaction.client.users.fetch(targetId); userTag = `**${u.tag}**`; } catch { /* skip */ }

      return interaction.reply({ embeds: [
        added
          ? embed.success('Spam Access Granted', ` ${userTag} can now use the spam command.`)
          : embed.warn('Already Permitted', 'That user already has spam access.')
      ], flags: 64 });
    }
  },

  // ─────────────────────────────────────────
  // SPAMREVOKE
  // ─────────────────────────────────────────
  {
    name: 'spamrevoke',
    description: ' Revoke a user\'s spam permission. (Bot Owner only)',
    category: 'owner',
    hidden: true,
    permissions: [],
    options: [
      {
        name: 'userid',
        description: 'The Discord User ID to revoke',
        type: ApplicationCommandOptionType.String,
        required: true
      }
    ],

    async executePrefix(message, args) {
      if (!isBotOwnerSync(message.author.id)) return;
      const targetId = args[0]?.replace(/\D/g, '');
      if (!targetId || targetId.length < 17) return message.reply({ embeds: [embed.warn('Usage Error', `**Usage:** \`spamrevoke <userId>\``)] });
      const removed = db.removeSpamPermit(targetId);
      let userTag = `\`${targetId}\``;
      try { const u = await message.client.users.fetch(targetId); userTag = `**${u.tag}**`; } catch { /* skip */ }
      return message.reply({ embeds: [removed
        ? embed.danger('Spam Access Revoked', ` ${userTag}'s spam access has been revoked.`)
        : embed.warn('Not Found', `User \`${targetId}\` doesn't have spam access.`)
      ]});
    },

    async executeSlash(interaction) {
      if (!isBotOwnerSync(interaction.user.id)) return interaction.reply({ embeds: [embed.danger('Access Denied', 'Bot Owner only.')], flags: 64 });
      const targetId = interaction.options.getString('userid').replace(/\D/g, '');
      const removed = db.removeSpamPermit(targetId);
      let userTag = `\`${targetId}\``;
      try { const u = await interaction.client.users.fetch(targetId); userTag = `**${u.tag}**`; } catch { /* skip */ }
      return interaction.reply({ embeds: [removed
        ? embed.danger('Spam Access Revoked', ` ${userTag}'s spam access has been revoked.`)
        : embed.warn('Not Found', "That user doesn't have spam access.")
      ], flags: 64 });
    }
  },

  // ─────────────────────────────────────────
  // SPAMLIST
  // ─────────────────────────────────────────
  {
    name: 'spamlist',
    description: ' List all permitted spam users. (Bot Owner only)',
    category: 'owner',
    hidden: true,
    permissions: [],
    options: [],

    async executePrefix(message) {
      if (!isBotOwnerSync(message.author.id)) return;
      const list = db.getSpamPermitted();
      if (list.length === 0) return message.reply({ embeds: [embed.info('Spam Permitted List', '� No users have spam access yet.')] });
      const lines = await Promise.all(list.map(async (id, i) => {
        try { const u = await message.client.users.fetch(id); return `${i+1}. **${u.tag}** (\`${id}\`)`; } catch { return `${i+1}. \`${id}\``; }
      }));
      return message.reply({ embeds: [embed.security('Spam Access List', `� **Permitted users:**\n\n${lines.join('\n')}\n\nTotal: **${list.length}**`)] });
    },

    async executeSlash(interaction) {
      if (!isBotOwnerSync(interaction.user.id)) return interaction.reply({ embeds: [embed.danger('Access Denied', 'Bot Owner only.')], flags: 64 });
      const list = db.getSpamPermitted();
      if (list.length === 0) return interaction.reply({ embeds: [embed.info('Spam Permitted List', '� No users have spam access yet.')], flags: 64 });
      const lines = await Promise.all(list.map(async (id, i) => {
        try { const u = await interaction.client.users.fetch(id); return `${i+1}. **${u.tag}** (\`${id}\`)`; } catch { return `${i+1}. \`${id}\``; }
      }));
      return interaction.reply({ embeds: [embed.security('Spam Access List', `� **Permitted users:**\n\n${lines.join('\n')}\n\nTotal: **${list.length}**`)], flags: 64 });
    }
  }
];

// ─────────────────────────────────────────
// MODAL HANDLER
// ─────────────────────────────────────────
export async function handleSpamModal(interaction) {
  const userId = interaction.user.id;
  if (!isBotOwnerSync(userId) && !db.isSpamPermitted(userId)) {
    return interaction.reply({ content: ' Access Denied.', flags: 64 });
  }

  const text = interaction.fields.getTextInputValue('spam_message').trim();
  const countStr = interaction.fields.getTextInputValue('spam_count').trim();
  const count = Math.min(Math.max(parseInt(countStr) || 5, 1), 10);

  if (!text) return interaction.reply({ embeds: [embed.warn('Empty Message', 'You must enter a message.')], flags: 64 });

  await interaction.reply({ content: ' Spamming...', flags: 64 });

  await executeChannelSpam(interaction.channel, text, count);
  const row = buildSpamMoreRow(userId, interaction.channel.id, null, text, 'channel');

  await interaction.followUp({
    embeds: [embed.success('Spam Deployed ', `Message sent **${count}x** anonymously.`)],
    components: [row],
    flags: 64
  }).catch(() => null);
}

// ─────────────────────────────────────────
// SPAM MORE BUTTON HANDLER
// Button only works for the user who triggered the original spam
// ─────────────────────────────────────────
export async function handleSpamMoreButton(interaction) {
  const customId = interaction.customId; // spam_more_<userId>_<timestamp>
  const parts = customId.split('_');
  const buttonOwnerId = parts[2];

  if (interaction.user.id !== buttonOwnerId) {
    return interaction.reply({ content: ' This button is not for you.', flags: 64 });
  }

  const cacheEntry = spamMoreCache.get(customId);
  if (!cacheEntry) {
    return interaction.reply({ content: ' This spam session has expired (10 min limit).', flags: 64 });
  }

  await interaction.reply({ content: ' Sending 5 more...', flags: 64 });

  try {
    if (cacheEntry.mode === 'user_dm') {
      const result = await spamUserDm(interaction.client, cacheEntry.targetUserId, cacheEntry.text, 5, interaction.user.id);
      const newRow = buildSpamMoreRow(interaction.user.id, null, cacheEntry.targetUserId, cacheEntry.text, 'user_dm');
      await interaction.followUp({
        embeds: [result.success
          ? embed.success('5 More Sent ', 'Sent 5 more DMs. Press again to send 5 more.')
          : embed.warn('DM Failed', result.message)
        ],
        components: result.success ? [newRow] : [],
        flags: 64
      }).catch(() => null);
    } else {
      const channel = await interaction.client.channels.fetch(cacheEntry.channelId).catch(() => null);
      if (channel) {
        await executeChannelSpam(channel, cacheEntry.text, 5);
        const newRow = buildSpamMoreRow(interaction.user.id, cacheEntry.channelId, null, cacheEntry.text, 'channel');
        await interaction.followUp({
          embeds: [embed.success('5 More Sent ', 'Sent 5 more. Press again for 5 more.')],
          components: [newRow],
          flags: 64
        }).catch(() => null);
      }
    }
  } catch (err) {
    console.error('[SpamMore]', err);
  }
}

// ─────────────────────────────────────────
// BUILD SPAM MORE BUTTON ROW
// Caches session data and returns an ActionRowBuilder
// ─────────────────────────────────────────
function buildSpamMoreRow(requesterId, channelId, targetUserId, text, mode) {
  const buttonId = `spam_more_${requesterId}_${Date.now()}`;
  spamMoreCache.set(buttonId, { text, channelId, targetUserId, mode, requesterId });
  setTimeout(() => spamMoreCache.delete(buttonId), 600000); // 10 min TTL

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(buttonId)
      .setLabel(' Send 5 More')
      .setStyle(ButtonStyle.Primary)
  );
}

// ─────────────────────────────────────────
// SPAM A TARGET USER'S DM
// Opens DM with target and sends the message N times
// ─────────────────────────────────────────
async function spamUserDm(client, targetUserId, text, count, requesterId) {
  try {
    const targetUser = await client.users.fetch(targetUserId);
    const dmChannel = await targetUser.createDM();

    for (let i = 0; i < count; i++) {
      await dmChannel.send(text).catch(() => null);
      await new Promise(r => setTimeout(r, 400));
    }

    return { success: true };
  } catch (err) {
    console.error('[SpamUserDM]', err);
    // Common reason: user has DMs closed
    if (err.code === 50007) return { success: false, message: 'Cannot send DMs to that user — they have DMs closed or have blocked the bot.' };
    return { success: false, message: `Failed to DM: ${err.message}` };
  }
}

// ─────────────────────────────────────────
// SPAM CURRENT CHANNEL (anonymous via webhook)
// ─────────────────────────────────────────
async function executeChannelSpam(channel, text, count) {
  // Guild channel: use webhook for anonymity
  if (channel.guild) {
    let webhook;
    try {
      const existing = await channel.fetchWebhooks().catch(() => null);
      webhook = existing?.find(wh => wh.name === 'Athena Relay');
      if (!webhook) webhook = await channel.createWebhook({ name: 'Athena Relay', reason: 'Spam relay' }).catch(() => null);
    } catch { /* skip */ }

    if (webhook) {
      for (let i = 0; i < count; i++) {
        await webhook.send({ content: text, username: 'Message', avatarURL: 'https://cdn.discordapp.com/embed/avatars/0.png' }).catch(() => null);
        await new Promise(r => setTimeout(r, 300));
      }
      return;
    }
  }

  // DM channel or webhook failed: send directly
  for (let i = 0; i < count; i++) {
    await channel.send(text).catch(() => null);
    await new Promise(r => setTimeout(r, 300));
  }
}
