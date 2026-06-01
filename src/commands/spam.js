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
// SPAM COMMAND — Anonymous message spammer
// Only accessible to permitted users (set by bot owner)
// ==========================================

export const commands = [

  // ─────────────────────────────────────────
  // SPAM — The actual spam command
  // ─────────────────────────────────────────
  {
    name: 'spam',
    description: '📨 Send a message 5 times anonymously. (Permitted users only)',
    category: 'owner',
    hidden: false,
    permissions: [],
    options: [
      {
        name: 'message',
        description: 'The message to spam (sent 5 times anonymously)',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'count',
        description: 'How many times to send (1-10, default 5)',
        type: ApplicationCommandOptionType.Integer,
        required: false,
        min_value: 1,
        max_value: 10
      }
    ],

    async executePrefix(message, args) {
      const userId = message.author.id;

      // Check permission — bot owner always allowed, others need permit
      if (!isBotOwnerSync(userId) && !db.isSpamPermitted(userId)) {
        return; // Silent — non-permitted users don't even know this exists
      }

      const text = args.join(' ').trim();
      if (!text) {
        return message.reply({
          embeds: [embed.warn('Spam Usage',
            `${message.author} 📨 **Usage:** \`spam <your message>\`\n\n` +
            `**Example:** \`spam Hello everyone!\`\n` +
            `The message will be sent **5 times anonymously** using a webhook.\n\n` +
            `**Tip:** You can also use the slash command \`/spam\` with a modal input.`
          )],
          flags: 64 // ephemeral-like — actually just reply
        }).catch(() => null);
      }

      // Delete the trigger message so no one knows who sent it
      await message.delete().catch(() => null);

      // Execute spam
      await executeSpam(message.channel, text, 5);
    },

    async executeSlash(interaction) {
      const userId = interaction.user.id;

      // Check permission
      if (!isBotOwnerSync(userId) && !db.isSpamPermitted(userId)) {
        return interaction.reply({
          embeds: [embed.danger('Access Denied', '🛡️ You do not have permission to use this command.')],
          ephemeral: true
        });
      }

      const text = interaction.options.getString('message');
      const count = interaction.options.getInteger('count') || 5;

      if (!text) {
        // Show modal for message input
        const modal = new ModalBuilder()
          .setCustomId(`spam_modal_${interaction.user.id}`)
          .setTitle('📨 Spam Manager');

        const msgInput = new TextInputBuilder()
          .setCustomId('spam_message')
          .setLabel('Message to spam')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Type your message here... it will be sent anonymously 5 times')
          .setRequired(true)
          .setMaxLength(1000);

        const countInput = new TextInputBuilder()
          .setCustomId('spam_count')
          .setLabel('How many times? (1-10)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('5')
          .setRequired(false)
          .setMaxLength(2);

        modal.addComponents(
          new ActionRowBuilder().addComponents(msgInput),
          new ActionRowBuilder().addComponents(countInput)
        );

        return interaction.showModal(modal);
      }

      // Has text — execute immediately
      await interaction.reply({ content: '📨 Spamming...', ephemeral: true });
      await executeSpam(interaction.channel, text, count);
    }
  },

  // ─────────────────────────────────────────
  // SPAMPERMIT — Grant spam access (bot owner only)
  // ─────────────────────────────────────────
  {
    name: 'spampermit',
    description: '🔑 Grant a user permission to use the spam command. (Bot Owner only)',
    category: 'owner',
    hidden: false,
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
      if (!isBotOwnerSync(message.author.id)) {
        return message.reply({ embeds: [embed.danger('Access Denied', `${message.author} 🛡️ Only the **Bot Owner** can permit spam access.`)] });
      }

      const targetId = args[0]?.replace(/\D/g, ''); // strip non-digits (handles @mention or raw ID)
      if (!targetId || targetId.length < 17) {
        return message.reply({
          embeds: [embed.warn('Usage Error',
            `${message.author} **Usage:** \`spampermit <userId>\`\n\n` +
            `**Example:** \`spampermit 123456789012345678\`\n` +
            `You can also tag the user: \`spampermit @user\``
          )]
        });
      }

      const added = db.addSpamPermit(targetId);
      if (added) {
        // Try to fetch user to show their tag
        let userTag = `\`${targetId}\``;
        try {
          const user = await message.client.users.fetch(targetId);
          userTag = `**${user.tag}** (\`${targetId}\`)`;
        } catch { /* user not found */ }

        return message.reply({
          embeds: [embed.success('Spam Access Granted',
            `${message.author} ✅ ${userTag} has been granted **spam command access**.\n` +
            `They can now use \`spam\` or \`/spam\` to send anonymous messages.`
          )]
        });
      } else {
        return message.reply({
          embeds: [embed.warn('Already Permitted', `${message.author} User \`${targetId}\` already has spam access.`)]
        });
      }
    },

    async executeSlash(interaction) {
      if (!isBotOwnerSync(interaction.user.id)) {
        return interaction.reply({ embeds: [embed.danger('Access Denied', `${interaction.user} 🛡️ Only the **Bot Owner** can permit spam access.`)], ephemeral: true });
      }

      const targetId = interaction.options.getString('userid').replace(/\D/g, '');
      if (!targetId || targetId.length < 17) {
        return interaction.reply({
          embeds: [embed.warn('Invalid ID', `${interaction.user} Please provide a valid Discord User ID (17-19 digits).`)],
          ephemeral: true
        });
      }

      const added = db.addSpamPermit(targetId);
      let userTag = `\`${targetId}\``;
      try {
        const user = await interaction.client.users.fetch(targetId);
        userTag = `**${user.tag}** (\`${targetId}\`)`;
      } catch { /* skip */ }

      if (added) {
        return interaction.reply({
          embeds: [embed.success('Spam Access Granted',
            `${interaction.user} ✅ ${userTag} has been granted **spam command access**.`
          )],
          ephemeral: true
        });
      } else {
        return interaction.reply({
          embeds: [embed.warn('Already Permitted', `${interaction.user} That user already has spam access.`)],
          ephemeral: true
        });
      }
    }
  },

  // ─────────────────────────────────────────
  // SPAMREVOKE — Remove spam access (bot owner only)
  // ─────────────────────────────────────────
  {
    name: 'spamrevoke',
    description: '🔒 Revoke a user\'s spam command permission. (Bot Owner only)',
    category: 'owner',
    hidden: false,
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
      if (!isBotOwnerSync(message.author.id)) {
        return message.reply({ embeds: [embed.danger('Access Denied', `${message.author} 🛡️ Only the **Bot Owner** can revoke spam access.`)] });
      }

      const targetId = args[0]?.replace(/\D/g, '');
      if (!targetId || targetId.length < 17) {
        return message.reply({
          embeds: [embed.warn('Usage Error',
            `${message.author} **Usage:** \`spamrevoke <userId>\`\n\n` +
            `**Example:** \`spamrevoke 123456789012345678\``
          )]
        });
      }

      const removed = db.removeSpamPermit(targetId);
      if (removed) {
        let userTag = `\`${targetId}\``;
        try {
          const user = await message.client.users.fetch(targetId);
          userTag = `**${user.tag}** (\`${targetId}\`)`;
        } catch { /* skip */ }

        return message.reply({
          embeds: [embed.danger('Spam Access Revoked',
            `${message.author} 🔒 ${userTag}'s spam access has been **revoked**.\n` +
            `They can no longer use the spam command.`
          )]
        });
      } else {
        return message.reply({
          embeds: [embed.warn('Not Found', `${message.author} User \`${targetId}\` doesn't have spam access.`)]
        });
      }
    },

    async executeSlash(interaction) {
      if (!isBotOwnerSync(interaction.user.id)) {
        return interaction.reply({ embeds: [embed.danger('Access Denied', `${interaction.user} 🛡️ Only the **Bot Owner** can revoke spam access.`)], ephemeral: true });
      }

      const targetId = interaction.options.getString('userid').replace(/\D/g, '');
      if (!targetId || targetId.length < 17) {
        return interaction.reply({
          embeds: [embed.warn('Invalid ID', `${interaction.user} Please provide a valid Discord User ID.`)],
          ephemeral: true
        });
      }

      const removed = db.removeSpamPermit(targetId);
      let userTag = `\`${targetId}\``;
      try {
        const user = await interaction.client.users.fetch(targetId);
        userTag = `**${user.tag}** (\`${targetId}\`)`;
      } catch { /* skip */ }

      if (removed) {
        return interaction.reply({
          embeds: [embed.danger('Spam Access Revoked', `${interaction.user} 🔒 ${userTag}'s spam access has been **revoked**.`)],
          ephemeral: true
        });
      } else {
        return interaction.reply({
          embeds: [embed.warn('Not Found', `${interaction.user} That user doesn't have spam access.`)],
          ephemeral: true
        });
      }
    }
  },

  // ─────────────────────────────────────────
  // SPAMLIST — List all permitted users (bot owner only)
  // ─────────────────────────────────────────
  {
    name: 'spamlist',
    description: '📋 List all users permitted to use the spam command. (Bot Owner only)',
    category: 'owner',
    hidden: false,
    permissions: [],
    options: [],

    async executePrefix(message) {
      if (!isBotOwnerSync(message.author.id)) return;

      const list = db.getSpamPermitted();
      if (list.length === 0) {
        return message.reply({ embeds: [embed.info('Spam Permitted List', '📋 No users have been granted spam access yet.\n\nUse `spampermit <userId>` to grant access.')] });
      }

      const lines = await Promise.all(list.map(async (id, i) => {
        try {
          const user = await message.client.users.fetch(id);
          return `${i + 1}. **${user.tag}** (\`${id}\`)`;
        } catch {
          return `${i + 1}. \`${id}\` (User not found)`;
        }
      }));

      return message.reply({
        embeds: [embed.security('Spam Access List',
          `📋 **Users with spam access:**\n\n${lines.join('\n')}\n\n` +
          `Total: **${list.length}** user(s)`
        )]
      });
    },

    async executeSlash(interaction) {
      if (!isBotOwnerSync(interaction.user.id)) {
        return interaction.reply({ embeds: [embed.danger('Access Denied', '🛡️ Only the Bot Owner can view this list.')], ephemeral: true });
      }

      const list = db.getSpamPermitted();
      if (list.length === 0) {
        return interaction.reply({
          embeds: [embed.info('Spam Permitted List', '📋 No users have spam access yet.\n\nUse `/spampermit` to grant access.')],
          ephemeral: true
        });
      }

      const lines = await Promise.all(list.map(async (id, i) => {
        try {
          const user = await interaction.client.users.fetch(id);
          return `${i + 1}. **${user.tag}** (\`${id}\`)`;
        } catch {
          return `${i + 1}. \`${id}\` (User not found)`;
        }
      }));

      return interaction.reply({
        embeds: [embed.security('Spam Access List',
          `📋 **Users with spam access:**\n\n${lines.join('\n')}\n\nTotal: **${list.length}** user(s)`
        )],
        ephemeral: true
      });
    }
  }
];

// ─────────────────────────────────────────
// SPAM MODAL HANDLER — called from interactionCreate
// ─────────────────────────────────────────
export async function handleSpamModal(interaction) {
  const userId = interaction.user.id;

  if (!isBotOwnerSync(userId) && !db.isSpamPermitted(userId)) {
    return interaction.reply({ content: '🛡️ Access Denied.', ephemeral: true });
  }

  const text = interaction.fields.getTextInputValue('spam_message').trim();
  const countStr = interaction.fields.getTextInputValue('spam_count').trim();
  const count = parseInt(countStr) || 5;
  const finalCount = Math.min(Math.max(count, 1), 10);

  if (!text) {
    return interaction.reply({ embeds: [embed.warn('Empty Message', 'You must enter a message to spam.')], ephemeral: true });
  }

  await interaction.reply({ content: `📨 Spamming ${finalCount}x anonymously...`, ephemeral: true });
  await executeSpam(interaction.channel, text, finalCount);
}

// ─────────────────────────────────────────
// CORE SPAM ENGINE — sends message via webhook (anonymous)
// ─────────────────────────────────────────
async function executeSpam(channel, text, count) {
  try {
    // Use webhook for true anonymity — the message won't be from Athena Prime
    let webhook;
    const existingWebhooks = await channel.fetchWebhooks().catch(() => null);

    if (existingWebhooks) {
      webhook = existingWebhooks.find(wh => wh.name === 'Athena Relay');
    }

    if (!webhook) {
      webhook = await channel.createWebhook({
        name: 'Athena Relay',
        reason: 'Spam relay webhook'
      }).catch(() => null);
    }

    if (webhook) {
      // Send via webhook — completely anonymous, looks like a generic user
      for (let i = 0; i < count; i++) {
        await webhook.send({
          content: text,
          username: 'Message',
          avatarURL: 'https://cdn.discordapp.com/embed/avatars/0.png'
        });
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 300));
      }
    } else {
      // Fallback: send via bot if webhook creation failed
      for (let i = 0; i < count; i++) {
        await channel.send(text).catch(() => null);
        await new Promise(r => setTimeout(r, 300));
      }
    }
  } catch (error) {
    console.error('[SPAM] Error executing spam:', error);
  }
}
