import { 
  PermissionFlagsBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelSelectMenuBuilder, 
  StringSelectMenuBuilder, 
  ChannelType, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  MessageFlags 
} from 'discord.js';
import cv2 from '../cv2.js';
import { setGuildContext } from '../embed.js';
import db from '../database.js';
import { generateAIResponse } from '../utils/ai.js';

// In-memory active announcement drafts keyed by message ID
export const announcementDrafts = new Map();

// Regularly clean up drafts older than 2 hours
setInterval(() => {
  const now = Date.now();
  for (const [key, draft] of announcementDrafts.entries()) {
    if (now - draft.lastUpdated > 2 * 60 * 60 * 1000) {
      announcementDrafts.delete(key);
    }
  }
}, 30 * 60 * 1000).unref();

/**
 * Restores any custom Discord emojis (<:name:id> or <a:name:id>) if the AI truncated them to <:name> or :name:
 */
export function restoreCustomEmojis(text, sourcePrompt) {
  if (!text || !sourcePrompt) return text;
  const customEmojis = sourcePrompt.match(/<a?:[a-zA-Z0-9_]+:\d+>/g) || [];
  let result = text;
  for (const emoji of customEmojis) {
    const match = emoji.match(/<a?:([a-zA-Z0-9_]+):(\d+)>/);
    if (match) {
      const [, name] = match;
      const truncatedRegex = new RegExp('<a?:' + name + '(?::\\d*)?>|(?<!<):' + name + ':', 'g');
      result = result.replace(truncatedRegex, emoji);
    }
  }
  return result;
}

/**
 * Parses raw AI output containing delimiters into structured title and grey-formatted body
 */
export function parseAnnouncementOutput(rawText, fallbackPrompt = 'Server Announcement', sourcePrompt = '') {
  if (!rawText) {
    return {
      title: 'Server Announcement',
      body: '-# Important announcement for all members.'
    };
  }

  // Restore any custom emojis from the original prompt if AI truncated them
  const restoredText = restoreCustomEmojis(rawText, sourcePrompt);

  let title = '';
  let body = '';

  const titleMatch = restoredText.match(/===TITLE===\s*([\s\S]*?)(?:===BODY===|$)/i);
  const bodyMatch = restoredText.match(/===BODY===\s*([\s\S]*$)/i);

  if (titleMatch && titleMatch[1].trim()) {
    title = titleMatch[1].trim();
    body = bodyMatch ? bodyMatch[1].trim() : '';
  } else {
    // Delimiters missing fallback: take line 1 as title, remaining lines as body
    const lines = restoredText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      title = lines[0];
      body = lines.slice(1).join('\n');
    } else {
      title = 'Server Announcement';
      body = restoredText;
    }
  }

  // Strip heading hashes, delimiters, and brackets from title
  title = title
    .replace(/^[=\-_*~#\s]+|[=\-_*~#\s]+$/g, '')
    .replace(/^\[|\]$/g, '')
    .replace(/^#+\s*/, '')
    .replace(/^-#\s*/, '')
    .replace(/^\*\*__|\__\*\*$/g, '')
    .trim();

  if (!title) {
    title = fallbackPrompt.length > 40 ? fallbackPrompt.slice(0, 37) + '...' : fallbackPrompt;
  }

  return {
    title,
    body: cleanAnnouncementBody(body)
  };
}

/**
 * Ensures all body lines are formatted with Discord subtext grey fonts (-#) and grey bold underline highlights
 */
export function cleanAnnouncementBody(text) {
  if (!text) return '-# No content provided.';
  const lines = text.split('\n');
  const formatted = [];

  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed) {
      formatted.push('');
      continue;
    }

    // Skip redundant delimiter lines
    if (/^[=\-_*~]{2,}/.test(trimmed) || /^(?:===+)?BODY(?:===+)?/i.test(trimmed) || /^(?:===+)?TITLE(?:===+)?/i.test(trimmed)) {
      continue;
    }

    // Strip multiple redundant -# prefixes
    trimmed = trimmed.replace(/^(?:-#\s*)+/, '').trim();

    // If line is enclosed in square brackets e.g. [Notice here], strip the brackets
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      trimmed = trimmed.slice(1, -1).trim();
    }

    if (!trimmed) continue;

    // Convert bold **text** to **__text__** for grey bold underline highlight
    trimmed = trimmed
      .replace(/__\*\*([^*_]+)\*\*__/g, '**__$1__**')
      .replace(/\*\*(?!__)(.*?)(?<!__)\*\*/g, '**__$1__**');

    formatted.push(`-# ${trimmed}`);
  }

  return formatted.join('\n');
}

/**
 * Core AI generation engine with human-speech error handling, custom emoji placement, and thinking pipeline
 */
export async function generateAIAnnouncement(userPrompt, previousDraft = null, refinement = null) {
  let promptText = userPrompt;
  if (previousDraft && refinement) {
    promptText = `Current Announcement Draft:
Title: ${previousDraft.title}
Body:
${previousDraft.body}

User Refinement Request:
${refinement}`;
  }

  const customSystem = `You are Athena's elite Announcement Crafting Intelligence.
Your task is to transform informal, brief, or typo-filled user text into a stunning, professional, high-impact Discord announcement.

CRITICAL INSTRUCTIONS:
1. CUSTOM EMOJI EXTRACTION & HANDLING:
- If the user specifies an emoji for the heading/title (e.g., "use <:icon:123> in heading", "put 🎬 in title"), you MUST strictly include that exact emoji in the title.
- If the user specifies an emoji for bullets (e.g., "use <:popcorn:123> for bullets", "use 🍿 as bullets"), you MUST strictly use that exact emoji at the start of every bullet point.
- NEVER use generic Discord native emojis like ❌, ✅, ⚠️. If no custom bullet emoji is specified, use clean stylish bullets like • or an appropriate thematic bullet.
- Preserve any custom Discord emojis (<:name:id> or <a:name:id>) exactly as given.

2. FORMATTING RULES:
- NEVER truncate Discord custom emojis. Always output full <:name:id> or <a:name:id> format.
- DO NOT wrap titles or lines in square brackets.
- DO NOT repeat delimiter tags or write extra preamble.
- Output MUST strictly use the delimiters:
===TITLE===
[Title without leading # or markdown heading hashes, max 100 chars]
===BODY===
[The announcement body. EVERY line must begin with '-# ' for Discord grey subtext. Highlight key terms, dates, times, roles, prizes, or links with **__term:__**.]

Example Output:
===TITLE===
<:film:987654321> Interstellar Community Movie Night
===BODY===
-# Welcome everyone! Get ready for an epic cinematic journey through space and time.
-#
-# <:popcorn:123456789> **__Movie Title:__** Interstellar (2014)
-# <:popcorn:123456789> **__Start Time:__** 8:00 PM IST
-# <:popcorn:123456789> **__Venue:__** Community Voice & Stage Channel
-# <:popcorn:123456789> **__Reminders:__** Grab your popcorn, cold drinks, and cozy setup!
-#
-# Hop in early to catch the pre-show chat. See you there!`;

  try {
    const res = await generateAIResponse(promptText, { customSystem, raw: true });
    if (res.success && res.text) {
      return parseAnnouncementOutput(res.text, userPrompt, promptText);
    }
  } catch (err) {
    console.error('AI Announcement generation error:', err);
  }

  // Fallback if AI service encounters an issue
  return {
    title: 'Server Announcement',
    body: cleanAnnouncementBody(userPrompt)
  };
}

/**
 * Builds the CV2 Container for the Announcement Studio Preview or Published Announcement
 */
export function buildAnnouncementStudioContainer(draft, isPreview = true) {
  const comps = [];

  // 1. Heading Component (Bold Heading)
  const titleText = draft.title || 'Server Announcement';
  comps.push({
    type: 10,
    content: `# ${titleText}`
  });

  comps.push({ type: 14, divider: true });

  // 2. Body Component (Grey fonts with bold highlights)
  const bodyText = draft.body || '-# No announcement content set.';
  if (bodyText.length <= 3800) {
    comps.push({ type: 10, content: bodyText });
  } else {
    const chunks = bodyText.match(/[\s\S]{1,3800}/g) || [bodyText];
    for (let i = 0; i < chunks.length; i++) {
      comps.push({ type: 10, content: chunks[i] });
      if (i < chunks.length - 1) comps.push({ type: 14, divider: true });
    }
  }

  // 3. Optional Banner / Media Gallery
  if (draft.imageUrl && /^https?:\/\//i.test(draft.imageUrl)) {
    comps.push({ type: 14, divider: true });
    comps.push({
      type: 12,
      items: [{ media: { url: draft.imageUrl } }]
    });
  }

  comps.push({ type: 14, divider: true });

  if (isPreview) {
    // Studio status line
    const targetText = draft.targetChannelId ? `<#${draft.targetChannelId}>` : '`Not Selected`';
    const pingLabel = draft.pingMode === 'everyone' ? '@everyone' : (draft.pingMode === 'here' ? '@here' : 'None');
    
    comps.push({
      type: 10,
      content: `-# 🛠️ **AI Announcement Studio Controls** \u00b7 Target: ${targetText} \u00b7 Broadcast: \`${pingLabel}\``
    });

    // Row 1: Target Channel Select
    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId('ann_select_channel')
      .setPlaceholder('Select target announcement channel...')
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
    if (draft.targetChannelId) {
      channelSelect.setDefaultChannels([draft.targetChannelId]);
    }
    const channelRow = new ActionRowBuilder().addComponents(channelSelect);
    comps.push(channelRow.toJSON());

    // Row 2: Broadcast Mention Select
    const pingSelect = new StringSelectMenuBuilder()
      .setCustomId('ann_select_ping')
      .setPlaceholder('Select broadcast mention mode...')
      .addOptions([
        {
          label: 'Silent (No Mention)',
          value: 'none',
          description: 'Post announcement cleanly without pinging members',
          default: !draft.pingMode || draft.pingMode === 'none'
        },
        {
          label: '@here (Online Members)',
          value: 'here',
          description: 'Mention online and active members in the channel',
          default: draft.pingMode === 'here'
        },
        {
          label: '@everyone (All Members)',
          value: 'everyone',
          description: 'Broadcast notification to all members of the server',
          default: draft.pingMode === 'everyone'
        }
      ]);
    const pingRow = new ActionRowBuilder().addComponents(pingSelect);
    comps.push(pingRow.toJSON());

    // Row 3: Action Buttons
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ann_deploy')
        .setLabel('Send Announcement')
        .setEmoji('<a:atheNATICK:1557841381630681106>')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ann_refine_ai')
        .setLabel('Refine with AI')
        .setEmoji('<:1dd48b63_d55f_467f_bc5c_04df55c7:1561262243352412221>')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ann_manual_edit')
        .setLabel('Manual Edit')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ann_set_media')
        .setLabel('Banner / Media')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ann_discard')
        .setLabel('Discard')
        .setStyle(ButtonStyle.Danger)
    );
    comps.push(buttonRow.toJSON());
  } else {
    // Published Footer
    comps.push({
      type: 10,
      content: `-# **Athena Prime Official Announcement**`
    });
  }

  return {
    type: 17,
    components: comps
  };
}

/**
 * Builds the initial Launcher Container for !announce with no args
 */
export function buildLauncherContainer() {
  return {
    type: 17,
    components: [
      {
        type: 10,
        content: `## Athena AI Announcement Studio | <a:uptime:1552608831060844575>\n-# Transform rough ideas, typo-filled notes, or brief human bullet points into stunning server announcements.\n-# Powered by Google Gemini 3.8 Flash High Intelligence Pipeline.`
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: `-# • **__Direct AI Command:__** \`!announce <your notes / prompt>\`\n-# • **__Interactive AI Studio:__** Click **Create with AI** below to launch the modal prompter.\n-# • **__Manual Studio:__** Click **Create Manually** to write directly.`
      },
      { type: 14, divider: true },
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ann_launcher_ai')
          .setLabel('Create with AI')
          .setEmoji('<:1dd48b63_d55f_467f_bc5c_04df55c7:1561262243352412221>')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ann_launcher_manual')
          .setLabel('Create Manually')
          .setStyle(ButtonStyle.Secondary)
      ).toJSON()
    ]
  };
}

/**
 * Safely extracts or reconstructs draft from Map or from existing Discord Components V2 message
 */
function getDraftFromInteraction(interaction) {
  const msgId = interaction.message?.id;
  if (msgId && announcementDrafts.has(msgId)) {
    return announcementDrafts.get(msgId);
  }

  // Attempt reconstruction from components in case of bot restart
  const components = interaction.message?.components || [];
  let title = 'Server Announcement';
  let body = '';
  let imageUrl = null;
  let targetChannelId = null;
  let pingMode = 'none';

  try {
    for (const comp of components) {
      if (comp.type === 17 && Array.isArray(comp.components)) {
        for (const inner of comp.components) {
          if (inner.type === 10 && inner.content) {
            if (inner.content.startsWith('# ') && title === 'Server Announcement') {
              title = inner.content.replace(/^#\s*/, '').trim();
            } else if (inner.content.startsWith('-#') && !inner.content.includes('AI Announcement Studio Controls')) {
              if (!body) body = inner.content;
            }
          }
          if (inner.type === 12 && inner.items?.[0]?.media?.url) {
            imageUrl = inner.items[0].media.url;
          }
        }
      }
    }
  } catch (e) {}

  const restoredDraft = {
    authorId: interaction.user.id,
    guildId: interaction.guildId,
    title,
    body: body || '-# No announcement content set.',
    imageUrl,
    targetChannelId,
    pingMode,
    originalPrompt: '',
    lastUpdated: Date.now()
  };

  if (msgId) {
    announcementDrafts.set(msgId, restoredDraft);
  }
  return restoredDraft;
}

export const commands = [
  {
    name: 'announce',
    description: 'Launch the AI Announcement Studio to craft, format, and broadcast announcements.',
    category: 'moderation',
    aliases: ['announcement', 'broadcast', 'an'],
    permissions: [PermissionFlagsBits.ManageMessages],
    options: [
      {
        name: 'prompt',
        description: 'Describe what to announce (AI will enhance, fix typos, format, and style it)',
        type: 3, // STRING
        required: false
      },
      {
        name: 'channel',
        description: 'Target channel to broadcast the announcement to',
        type: 7, // CHANNEL
        required: false
      }
    ],
    async executePrefix(message, args) {
      if (message.guild) setGuildContext(message.guild.id);

      const prompt = args.join(' ').trim();
      if (!prompt) {
        const launcher = buildLauncherContainer();
        return message.channel.send({ components: [launcher], flags: MessageFlags.IsComponentsV2 });
      }

      // Display thinking status while Gemini processes the announcement
      const thinkingContainer = {
        type: 17,
        components: [
          {
            type: 10,
            content: `## Crafting Announcement | <a:loading:1542155051286396938>\n-# Athena AI is analyzing your prompt and formatting your announcement...`
          }
        ]
      };

      const msg = await message.channel.send({ components: [thinkingContainer], flags: MessageFlags.IsComponentsV2 });

      const aiDraft = await generateAIAnnouncement(prompt);
      const draft = {
        authorId: message.author.id,
        guildId: message.guild.id,
        title: aiDraft.title,
        body: aiDraft.body,
        imageUrl: null,
        targetChannelId: null,
        pingMode: 'none',
        originalPrompt: prompt,
        lastUpdated: Date.now()
      };

      const previewContainer = buildAnnouncementStudioContainer(draft, true);
      await msg.edit({ components: [previewContainer], flags: MessageFlags.IsComponentsV2 });
      announcementDrafts.set(msg.id, draft);

      // Clean trigger message if permissions allow
      await message.delete().catch(() => null);
    },

    async executeSlash(interaction) {
      if (interaction.guild) setGuildContext(interaction.guild.id);

      const prompt = interaction.options.getString('prompt')?.trim();
      const targetChan = interaction.options.getChannel('channel');

      if (!prompt) {
        const launcher = buildLauncherContainer();
        return interaction.reply({ components: [launcher], flags: MessageFlags.IsComponentsV2 });
      }

      await interaction.deferReply();

      const thinkingContainer = {
        type: 17,
        components: [
          {
            type: 10,
            content: `## Crafting Announcement | <a:loading:1542155051286396938>\n-# Athena AI is analyzing your prompt and formatting your announcement...`
          }
        ]
      };
      await interaction.editReply({ components: [thinkingContainer], flags: MessageFlags.IsComponentsV2 });

      const aiDraft = await generateAIAnnouncement(prompt);
      const draft = {
        authorId: interaction.user.id,
        guildId: interaction.guild.id,
        title: aiDraft.title,
        body: aiDraft.body,
        imageUrl: null,
        targetChannelId: targetChan?.id || null,
        pingMode: 'none',
        originalPrompt: prompt,
        lastUpdated: Date.now()
      };

      const previewContainer = buildAnnouncementStudioContainer(draft, true);
      const replyMsg = await interaction.editReply({ components: [previewContainer], flags: MessageFlags.IsComponentsV2 });
      announcementDrafts.set(replyMsg.id, draft);
    }
  }
];

/**
 * Central Interaction Handler for Announcement Studio buttons, select menus, and modals
 */
export async function handleAnnouncementInteractions(interaction) {
  const member = interaction.member;
  if (!member || (!member.permissions.has(PermissionFlagsBits.ManageMessages) && !member.permissions.has(PermissionFlagsBits.Administrator))) {
    return interaction.reply({
      content: '-# You need **Manage Messages** permission to use the Announcement Studio.',
      flags: 64
    });
  }

  const customId = interaction.customId;

  // 1. Initial Launcher Buttons
  if (interaction.isButton()) {
    if (customId === 'ann_launcher_ai') {
      const modal = new ModalBuilder()
        .setCustomId('ann_modal_initial_ai')
        .setTitle('Create Announcement with AI');

      const promptInput = new TextInputBuilder()
        .setCustomId('ann_initial_prompt')
        .setLabel('What would you like to announce?')
        .setPlaceholder('e.g., hostin game night tonight at 8pm ist, use 🎮 in heading and <:trophy:...> for bullets...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(promptInput));
      return interaction.showModal(modal);
    }

    if (customId === 'ann_launcher_manual') {
      const modal = new ModalBuilder()
        .setCustomId('ann_modal_initial_manual')
        .setTitle('Create Announcement Manually');

      const titleInput = new TextInputBuilder()
        .setCustomId('ann_initial_title')
        .setLabel('Announcement Title')
        .setPlaceholder('Enter announcement title...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const bodyInput = new TextInputBuilder()
        .setCustomId('ann_initial_body')
        .setLabel('Content Body (-# grey subtext)')
        .setPlaceholder('Enter announcement details...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(bodyInput)
      );
      return interaction.showModal(modal);
    }
  }

  // 2. Draft Security Check
  const draft = getDraftFromInteraction(interaction);
  if (draft.authorId && draft.authorId !== interaction.user.id && !member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '-# Only the creator of this announcement draft or an Administrator can modify it.',
      flags: 64
    });
  }

  // 3. Dropdown Handlers
  if (interaction.isChannelSelectMenu() && customId === 'ann_select_channel') {
    draft.targetChannelId = interaction.values[0];
    draft.lastUpdated = Date.now();
    announcementDrafts.set(interaction.message.id, draft);
    return interaction.update({
      components: [buildAnnouncementStudioContainer(draft, true)],
      flags: MessageFlags.IsComponentsV2
    });
  }

  if (interaction.isStringSelectMenu() && customId === 'ann_select_ping') {
    draft.pingMode = interaction.values[0];
    draft.lastUpdated = Date.now();
    announcementDrafts.set(interaction.message.id, draft);
    return interaction.update({
      components: [buildAnnouncementStudioContainer(draft, true)],
      flags: MessageFlags.IsComponentsV2
    });
  }

  // 4. Studio Action Buttons
  if (interaction.isButton()) {
    if (customId === 'ann_deploy') {
      if (!draft.targetChannelId) {
        return interaction.reply({
          content: '-# Please select a target announcement channel from the dropdown first.',
          flags: 64
        });
      }

      // Strictly fetch channel by ID from database/guild
      const targetChannel = interaction.guild.channels.cache.get(draft.targetChannelId) 
        || await interaction.guild.channels.fetch(draft.targetChannelId).catch(() => null);

      if (!targetChannel) {
        return interaction.reply({
          content: '-# The selected target channel could not be found or fetched. Please re-select a channel.',
          flags: 64
        });
      }

      const botPerms = targetChannel.permissionsFor(interaction.guild.members.me);
      if (!botPerms || !botPerms.has(PermissionFlagsBits.SendMessages)) {
        return interaction.reply({
          content: `-# I do not have permission to send messages in <#${draft.targetChannelId}>. Please grant me Send Messages permission.`,
          flags: 64
        });
      }

      try {
        const publishedContainer = buildAnnouncementStudioContainer(draft, false);
        const pingContent = draft.pingMode === 'everyone' ? '@everyone' : (draft.pingMode === 'here' ? '@here' : undefined);

        const sentMsg = await targetChannel.send({
          content: pingContent,
          components: [publishedContainer],
          flags: MessageFlags.IsComponentsV2
        });

        // Update preview with custom success tick format: Heading | <a:atheNATICK:...>
        const successContainer = {
          type: 17,
          components: [
            {
              type: 10,
              content: `## Announcement Published | <a:atheNATICK:1557841381630681106>\n-# Successfully broadcasted to <#${draft.targetChannelId}>.\n-# • **__Jump to Announcement:__** [View Message](${sentMsg.url})\n-# • **__Broadcast Mention:__** \`${draft.pingMode === 'none' ? 'None' : '@' + draft.pingMode}\``
            }
          ]
        };

        await interaction.update({ components: [successContainer], flags: MessageFlags.IsComponentsV2 });
        announcementDrafts.delete(interaction.message.id);
        return;
      } catch (err) {
        console.error('Failed to deploy announcement:', err);
        return interaction.reply({
          content: `-# Failed to send announcement to <#${draft.targetChannelId}>. Error: ${err.message}`,
          flags: 64
        });
      }
    }

    if (customId === 'ann_refine_ai') {
      const modal = new ModalBuilder()
        .setCustomId('ann_modal_refine')
        .setTitle('Refine Announcement with AI');

      const refineInput = new TextInputBuilder()
        .setCustomId('ann_refine_prompt')
        .setLabel('What adjustments should AI make?')
        .setPlaceholder('e.g. make it shorter, add link, change bullet emoji to <:star:...>...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(refineInput));
      return interaction.showModal(modal);
    }

    if (customId === 'ann_manual_edit') {
      const modal = new ModalBuilder()
        .setCustomId('ann_modal_manual')
        .setTitle('Manual Edit Announcement');

      const titleInput = new TextInputBuilder()
        .setCustomId('ann_manual_title')
        .setLabel('Announcement Title')
        .setStyle(TextInputStyle.Short)
        .setValue((draft.title || 'Server Announcement').slice(0, 100))
        .setRequired(true);

      const bodyInput = new TextInputBuilder()
        .setCustomId('ann_manual_body')
        .setLabel('Content Body (-# grey font)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue((draft.body || '').slice(0, 3950))
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(bodyInput)
      );
      return interaction.showModal(modal);
    }

    if (customId === 'ann_set_media') {
      const modal = new ModalBuilder()
        .setCustomId('ann_modal_media')
        .setTitle('Set Banner / Media');

      const mediaInput = new TextInputBuilder()
        .setCustomId('ann_media_url')
        .setLabel('Image / Banner URL (Direct link)')
        .setPlaceholder('https://example.com/banner.png (or empty to clear)')
        .setStyle(TextInputStyle.Short)
        .setValue(draft.imageUrl || '')
        .setRequired(false);

      modal.addComponents(new ActionRowBuilder().addComponents(mediaInput));
      return interaction.showModal(modal);
    }

    if (customId === 'ann_discard') {
      announcementDrafts.delete(interaction.message.id);
      const discardedContainer = {
        type: 17,
        components: [
          {
            type: 10,
            content: `-# Announcement draft was discarded.`
          }
        ]
      };
      return interaction.update({ components: [discardedContainer], flags: MessageFlags.IsComponentsV2 });
    }
  }

  // 5. Modal Submissions
  if (interaction.isModalSubmit()) {
    if (customId === 'ann_modal_initial_ai') {
      const prompt = interaction.fields.getTextInputValue('ann_initial_prompt');

      const thinkingContainer = {
        type: 17,
        components: [
          {
            type: 10,
            content: `## Crafting Announcement | <a:loading:1542155051286396938>\n-# Athena AI is analyzing your prompt and formatting your announcement...`
          }
        ]
      };

      await interaction.update({ components: [thinkingContainer], flags: MessageFlags.IsComponentsV2 });

      const aiDraft = await generateAIAnnouncement(prompt);
      const newDraft = {
        authorId: interaction.user.id,
        guildId: interaction.guild.id,
        title: aiDraft.title,
        body: aiDraft.body,
        imageUrl: null,
        targetChannelId: null,
        pingMode: 'none',
        originalPrompt: prompt,
        lastUpdated: Date.now()
      };

      const previewContainer = buildAnnouncementStudioContainer(newDraft, true);
      await interaction.editReply({ components: [previewContainer], flags: MessageFlags.IsComponentsV2 });
      announcementDrafts.set(interaction.message.id, newDraft);
      return;
    }

    if (customId === 'ann_modal_initial_manual') {
      const title = interaction.fields.getTextInputValue('ann_initial_title');
      const body = interaction.fields.getTextInputValue('ann_initial_body');

      const newDraft = {
        authorId: interaction.user.id,
        guildId: interaction.guild.id,
        title: title.trim(),
        body: cleanAnnouncementBody(body),
        imageUrl: null,
        targetChannelId: null,
        pingMode: 'none',
        originalPrompt: '',
        lastUpdated: Date.now()
      };

      const previewContainer = buildAnnouncementStudioContainer(newDraft, true);
      await interaction.update({ components: [previewContainer], flags: MessageFlags.IsComponentsV2 });
      announcementDrafts.set(interaction.message.id, newDraft);
      return;
    }

    if (customId === 'ann_modal_refine') {
      const refinePrompt = interaction.fields.getTextInputValue('ann_refine_prompt');

      const thinkingContainer = {
        type: 17,
        components: [
          {
            type: 10,
            content: `## Refining Announcement | <a:loading:1542155051286396938>\n-# Athena AI is adjusting your announcement draft...`
          }
        ]
      };

      await interaction.update({ components: [thinkingContainer], flags: MessageFlags.IsComponentsV2 });

      const refined = await generateAIAnnouncement(draft.originalPrompt || draft.body, draft, refinePrompt);
      draft.title = refined.title;
      draft.body = refined.body;
      draft.lastUpdated = Date.now();

      const previewContainer = buildAnnouncementStudioContainer(draft, true);
      await interaction.editReply({ components: [previewContainer], flags: MessageFlags.IsComponentsV2 });
      announcementDrafts.set(interaction.message.id, draft);
      return;
    }

    if (customId === 'ann_modal_manual') {
      const title = interaction.fields.getTextInputValue('ann_manual_title');
      const body = interaction.fields.getTextInputValue('ann_manual_body');

      draft.title = title.trim();
      draft.body = cleanAnnouncementBody(body);
      draft.lastUpdated = Date.now();

      const previewContainer = buildAnnouncementStudioContainer(draft, true);
      await interaction.update({ components: [previewContainer], flags: MessageFlags.IsComponentsV2 });
      announcementDrafts.set(interaction.message.id, draft);
      return;
    }

    if (customId === 'ann_modal_media') {
      const url = interaction.fields.getTextInputValue('ann_media_url')?.trim();
      draft.imageUrl = url && /^https?:\/\//i.test(url) ? url : null;
      draft.lastUpdated = Date.now();

      const previewContainer = buildAnnouncementStudioContainer(draft, true);
      await interaction.update({ components: [previewContainer], flags: MessageFlags.IsComponentsV2 });
      announcementDrafts.set(interaction.message.id, draft);
      return;
    }
  }
}
