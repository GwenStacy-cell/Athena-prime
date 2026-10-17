import { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';
import { 
  generateAthenaGuideResponse, 
  buildGuideHubContainer, 
  buildAthenaGuideContainer,
  buildThinkingContainer,
  getGuideSession,
  clearGuideSession
} from '../utils/botGuideKnowledge.js';

const TICK = '<a:atheNATICK:1557841381630681106>';

/**
 * Creates a rate-limited real-time progress handler that edits the thinking container smoothly
 */
function createProgressHandler(target, session = null) {
  let lastEditTime = Date.now();
  let isEditing = false;
  let pendingUpdate = null;
  let pendingTimer = null;
  let active = true;

  const flush = async (update) => {
    if (!active || !target) return;
    isEditing = true;
    lastEditTime = Date.now();
    try {
      const container = buildThinkingContainer(update.title, update.detail, session);
      await cv2.edit(target, {
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    } catch {
      // Ignore transient network errors or deleted messages
    } finally {
      isEditing = false;
    }
  };

  return {
    onProgress: async ({ title, detail }) => {
      if (!active || !target) return;
      const now = Date.now();
      const elapsed = now - lastEditTime;

      if (elapsed >= 900 && !isEditing) {
        if (pendingTimer) {
          clearTimeout(pendingTimer);
          pendingTimer = null;
        }
        pendingUpdate = null;
        await flush({ title, detail });
      } else {
        pendingUpdate = { title, detail };
        if (!pendingTimer) {
          const waitTime = Math.max(100, 950 - elapsed);
          pendingTimer = setTimeout(async () => {
            pendingTimer = null;
            if (pendingUpdate && active) {
              const u = pendingUpdate;
              pendingUpdate = null;
              await flush(u);
            }
          }, waitTime);
        }
      }
    },
    stop: () => {
      active = false;
      pendingUpdate = null;
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
    }
  };
}

export const commands = [
  {
    name: 'athena',
    description: 'Ask Athena Prime directly to explain commands, resolve doubts, and give step-by-step guidance.',
    category: 'utility',
    aliases: ['guide', 'howto', 'askathena', 'assistant', 'athenahelp'],
    options: [
      {
        name: 'query',
        description: 'What question, doubt, or setup guidance do you need about Athena?',
        type: 3, // STRING
        required: false
      }
    ],
    async executePrefix(message, args) {
      const cfg = db.getGuildConfig(message.guild?.id || '0');
      const prefix = cfg?.prefix || '!';
      const accentColor = cfg?.accentColor || '#00e5ff';
      const prompt = args.join(' ').trim();

      // Reset / Clear Thread Memory Command
      if (prompt.toLowerCase() === 'reset' || prompt.toLowerCase() === 'clear') {
        clearGuideSession(message.guild?.id || '0', message.author.id, message.channel.id);
        const resetContainer = {
          type: 17,
          components: [
            {
              type: 10,
              content: `### **Conversation Thread Cleared | ${TICK}**\n-# Conversation memory has been reset for this channel. Your next query will start a fresh session.`
            }
          ]
        };
        return message.reply({ components: [resetContainer], flags: MessageFlags.IsComponentsV2 });
      }

      // If no prompt provided, show the interactive Guidance Hub
      if (!prompt) {
        const hub = buildGuideHubContainer(message.guild, message.author, prefix);
        return message.reply(hub);
      }

      const activeSession = getGuideSession(message.guild?.id || '0', message.author.id, message.channel.id);
      const shortPrompt = prompt.length > 45 ? prompt.slice(0, 42) + '...' : prompt;
      const initialContainer = buildThinkingContainer(
        activeSession && activeSession.turnCount >= 1
          ? `Scanning catalog & analyzing follow-up (Turn #${activeSession.turnCount + 1}) for: "${shortPrompt}"...`
          : `Athena Prime is scanning catalog of 250+ commands & detecting intent for: "${shortPrompt}"...`,
        activeSession && activeSession.turnCount >= 1
          ? `Thread active (rolling timer expires <t:${Math.floor(activeSession.expiresAt / 1000)}:R>) • Correlating with previous turns...`
          : `Analyzing command catalog and matching user keywords across system registries...`,
        activeSession
      );

      const thinkingMsg = await message.reply({
        components: [initialContainer],
        flags: MessageFlags.IsComponentsV2
      }).catch(() => null);

      const progress = createProgressHandler(thinkingMsg, activeSession);

      let aiResult;
      try {
        aiResult = await generateAthenaGuideResponse(prompt, {
          guild: message.guild,
          user: message.author,
          member: message.member,
          channelId: message.channel.id,
          prefix,
          onProgress: progress.onProgress
        });
      } finally {
        progress.stop();
      }

      const container = buildAthenaGuideContainer(message.author, prompt, aiResult, accentColor, prefix, aiResult.session);

      if (thinkingMsg) {
        try {
          await cv2.edit(thinkingMsg, { components: [container], flags: MessageFlags.IsComponentsV2 });
          return;
        } catch {
          await thinkingMsg.delete().catch(() => null);
        }
      }

      return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {
        return message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
      });
    },

    async executeSlash(interaction) {
      const cfg = db.getGuildConfig(interaction.guild?.id || '0');
      const prefix = cfg?.prefix || '!';
      const accentColor = cfg?.accentColor || '#00e5ff';
      const prompt = interaction.options.getString('query')?.trim();

      // Reset / Clear Thread Memory Command
      if (prompt && (prompt.toLowerCase() === 'reset' || prompt.toLowerCase() === 'clear')) {
        clearGuideSession(interaction.guild?.id || '0', interaction.user.id, interaction.channelId);
        const resetContainer = {
          type: 17,
          components: [
            {
              type: 10,
              content: `### **Conversation Thread Cleared | ${TICK}**\n-# Conversation memory has been reset for this channel. Your next query will start a fresh session.`
            }
          ]
        };
        return interaction.reply({ components: [resetContainer], flags: MessageFlags.IsComponentsV2 });
      }

      if (!prompt) {
        const hub = buildGuideHubContainer(interaction.guild, interaction.user, prefix);
        return interaction.reply(hub);
      }

      await interaction.deferReply();

      const activeSession = getGuideSession(interaction.guild?.id || '0', interaction.user.id, interaction.channelId);
      const shortPrompt = prompt.length > 45 ? prompt.slice(0, 42) + '...' : prompt;
      const initialContainer = buildThinkingContainer(
        activeSession && activeSession.turnCount >= 1
          ? `Scanning catalog & analyzing follow-up (Turn #${activeSession.turnCount + 1}) for: "${shortPrompt}"...`
          : `Athena Prime is scanning catalog of 250+ commands & detecting intent for: "${shortPrompt}"...`,
        activeSession && activeSession.turnCount >= 1
          ? `Thread active (rolling timer expires <t:${Math.floor(activeSession.expiresAt / 1000)}:R>) • Correlating with previous turns...`
          : `Analyzing command catalog and matching user keywords across system registries...`,
        activeSession
      );

      await cv2.edit(interaction, {
        components: [initialContainer],
        flags: MessageFlags.IsComponentsV2
      }).catch(() => null);

      const progress = createProgressHandler(interaction, activeSession);

      let aiResult;
      try {
        aiResult = await generateAthenaGuideResponse(prompt, {
          guild: interaction.guild,
          user: interaction.user,
          member: interaction.member,
          channelId: interaction.channelId,
          prefix,
          onProgress: progress.onProgress
        });
      } finally {
        progress.stop();
      }

      const container = buildAthenaGuideContainer(interaction.user, prompt, aiResult, accentColor, prefix, aiResult.session);
      return cv2.edit(interaction, { components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      });
    }
  }
];

export async function handleAthenaGuideButtons(interaction) {
  const { customId, guild, user, member } = interaction;
  const cfg = db.getGuildConfig(guild?.id || '0');
  const prefix = cfg?.prefix || '!';
  const accentColor = cfg?.accentColor || '#00e5ff';

  if (customId === 'athena_reset_thread') {
    clearGuideSession(guild?.id || '0', user.id, interaction.channelId);
    return cv2.respond(interaction, {
      components: [
        {
          type: 17,
          components: [
            {
              type: 10,
              content: `### **Conversation Thread Cleared | ${TICK}**\n-# Conversation memory has been reset for this channel. You can now start a fresh topic with \`${prefix}athena <question>\`.`
            }
          ]
        }
      ],
      flags: MessageFlags.IsComponentsV2
    }, 7).catch(() => null);
  }

  if (customId === 'athena_guide_hub') {
    const hub = buildGuideHubContainer(guild, user, prefix);
    return cv2.respond(interaction, hub, 7).catch(() => null);
  }

  // --- MODAL: ASK FOLLOW-UP DOUBT ---
  if (customId === 'athena_ask_followup') {
    const activeSession = getGuideSession(guild?.id || '0', user.id, interaction.channelId);
    const topicCmd = activeSession?.primaryCommand ? `!${activeSession.primaryCommand}` : 'this command';

    const modal = new ModalBuilder()
      .setCustomId('athena_doubt_modal')
      .setTitle('Athena Prime • Ask a Follow-Up');

    const doubtInput = new TextInputBuilder()
      .setCustomId('athena_doubt_input')
      .setLabel(`FOLLOW-UP DOUBT (${topicCmd})`.slice(0, 45))
      .setPlaceholder(`Ask any doubt about ${topicCmd} (e.g. how to customize, permissions, troubleshooting)...`.slice(0, 100))
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(2)
      .setMaxLength(1000)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(doubtInput));
    return interaction.showModal(modal);
  }

  // --- MODAL SUBMIT: PROCESS USER DOUBT ---
  if (interaction.isModalSubmit && interaction.isModalSubmit() && customId === 'athena_doubt_modal') {
    const userDoubt = interaction.fields.getTextInputValue('athena_doubt_input');
    await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 }).catch(() => null);

    const activeSession = getGuideSession(guild?.id || '0', user.id, interaction.channelId);
    const initialContainer = buildThinkingContainer(
      `Athena Prime is analyzing your follow-up inquiry...`,
      `Synthesizing codebase logic and active thread context...`,
      activeSession
    );

    await cv2.edit(interaction, {
      components: [initialContainer],
      flags: MessageFlags.IsComponentsV2
    }).catch(() => null);

    const progress = createProgressHandler(interaction, activeSession);

    let aiResult;
    try {
      aiResult = await generateAthenaGuideResponse(userDoubt, {
        guild,
        user,
        member,
        channelId: interaction.channelId,
        prefix,
        onProgress: progress.onProgress
      });
    } finally {
      progress.stop();
    }

    const container = buildAthenaGuideContainer(user, userDoubt, aiResult, accentColor, prefix, aiResult.session);
    return cv2.edit(interaction, { components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
  }

  // --- CLICKABLE CONTEXTUAL SUGGESTION PILL CHIPS ---
  if (customId && customId.startsWith('athena_fu_')) {
    const idx = parseInt(customId.replace('athena_fu_', ''), 10);
    const activeSession = getGuideSession(guild?.id || '0', user.id, interaction.channelId);
    let query = activeSession?.suggestedFollowUps?.[idx] || interaction.component?.label;
    if (!query) {
      query = `More details on ${activeSession?.primaryCommand || 'this command'}`;
    }

    await interaction.deferUpdate().catch(() => null);

    const initialContainer = buildThinkingContainer(
      `Athena Prime is deep-diving into "${query.slice(0, 50)}"...`,
      `Reading codebase specifications and command execution flows...`,
      activeSession
    );

    await cv2.edit(interaction, {
      components: [initialContainer],
      flags: MessageFlags.IsComponentsV2
    }).catch(() => null);

    const progress = createProgressHandler(interaction, activeSession);

    let aiResult;
    try {
      aiResult = await generateAthenaGuideResponse(query, {
        guild,
        user,
        member,
        channelId: interaction.channelId,
        prefix,
        onProgress: progress.onProgress
      });
    } finally {
      progress.stop();
    }

    const container = buildAthenaGuideContainer(user, query, aiResult, accentColor, prefix, aiResult.session);
    return cv2.edit(interaction, { components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
  }

  const topicPrompts = {
    'athena_topic_security': 'How do I configure Athena Prime Security and Antinuke to protect against rogue admins, role exploits, and unauthorized bot adds?',
    'athena_topic_automod': 'How do I setup Automod and enable the AI Toxicity and Doxxing intercept shield?',
    'athena_topic_tickets': 'How do I deploy the support ticket system with voice channels and Smart AI Triage for ban appeals?',
    'athena_topic_minigames': 'How do I use and configure the server economy and casino minigames (Blackjack, Roulette, Trivia)?',
    'athena_topic_lockdown': 'How does Panic Lockdown Tier 1, Tier 2, and Tier 3 work and how do I safely unlockdown?',
    'athena_topic_learn': 'What is Heuristic Learn Mode and how do I baseline my server staff actions?'
  };

  if (topicPrompts[customId]) {
    await interaction.deferUpdate().catch(() => null);
    const query = topicPrompts[customId];

    const activeSession = getGuideSession(guild?.id || '0', user.id, interaction.channelId);
    const initialContainer = buildThinkingContainer(
      `Athena Prime is scanning module architecture & system domain...`,
      `Reading deep-dive specifications and real source files...`,
      activeSession
    );

    await cv2.edit(interaction, {
      components: [initialContainer],
      flags: MessageFlags.IsComponentsV2
    }).catch(() => null);

    const progress = createProgressHandler(interaction, activeSession);

    let aiResult;
    try {
      aiResult = await generateAthenaGuideResponse(query, {
        guild,
        user,
        member,
        channelId: interaction.channelId,
        prefix,
        onProgress: progress.onProgress
      });
    } finally {
      progress.stop();
    }

    const container = buildAthenaGuideContainer(user, query, aiResult, accentColor, prefix, aiResult.session);
    return cv2.edit(interaction, { components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
  }

  if (customId === 'athena_topic_help') {
    const { buildHelpContainer } = await import('./utility.js');
    const helpContainer = buildHelpContainer(interaction.client, guild?.id, 'home');
    return cv2.respond(interaction, { components: [helpContainer], flags: MessageFlags.IsComponentsV2 }, 7).catch(() => null);
  }
}

export default commands;
