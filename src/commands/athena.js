import { MessageFlags } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';
import { 
  generateAthenaGuideResponse, 
  buildGuideHubContainer, 
  buildAthenaGuideContainer,
  buildThinkingContainer
} from '../utils/botGuideKnowledge.js';

/**
 * Creates a rate-limited real-time progress handler that edits the thinking container smoothly
 */
function createProgressHandler(target) {
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
      const container = buildThinkingContainer(update.title, update.detail);
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

      // If no prompt provided, show the interactive Guidance Hub
      if (!prompt) {
        const hub = buildGuideHubContainer(message.guild, message.author, prefix);
        return message.reply(hub);
      }

      const shortPrompt = prompt.length > 45 ? prompt.slice(0, 42) + '...' : prompt;
      const initialContainer = buildThinkingContainer(
        `Athena Prime is scanning catalog of 250+ commands & detecting intent for: "${shortPrompt}"...`,
        `Analyzing command catalog and matching user keywords across system registries...`
      );

      const thinkingMsg = await message.reply({
        components: [initialContainer],
        flags: MessageFlags.IsComponentsV2
      }).catch(() => null);

      const progress = createProgressHandler(thinkingMsg);

      let aiResult;
      try {
        aiResult = await generateAthenaGuideResponse(prompt, {
          guild: message.guild,
          user: message.author,
          prefix,
          onProgress: progress.onProgress
        });
      } finally {
        progress.stop();
      }

      const container = buildAthenaGuideContainer(message.author, prompt, aiResult, accentColor, prefix);

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

      if (!prompt) {
        const hub = buildGuideHubContainer(interaction.guild, interaction.user, prefix);
        return interaction.reply(hub);
      }

      await interaction.deferReply();

      const shortPrompt = prompt.length > 45 ? prompt.slice(0, 42) + '...' : prompt;
      const initialContainer = buildThinkingContainer(
        `Athena Prime is scanning catalog of 250+ commands & detecting intent for: "${shortPrompt}"...`,
        `Analyzing command catalog and matching user keywords across system registries...`
      );

      await cv2.edit(interaction, {
        components: [initialContainer],
        flags: MessageFlags.IsComponentsV2
      }).catch(() => null);

      const progress = createProgressHandler(interaction);

      let aiResult;
      try {
        aiResult = await generateAthenaGuideResponse(prompt, {
          guild: interaction.guild,
          user: interaction.user,
          prefix,
          onProgress: progress.onProgress
        });
      } finally {
        progress.stop();
      }

      const container = buildAthenaGuideContainer(interaction.user, prompt, aiResult, accentColor, prefix);
      return cv2.edit(interaction, { components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      });
    }
  }
];

export async function handleAthenaGuideButtons(interaction) {
  const { customId, guild, user } = interaction;
  const cfg = db.getGuildConfig(guild?.id || '0');
  const prefix = cfg?.prefix || '!';
  const accentColor = cfg?.accentColor || '#00e5ff';

  if (customId === 'athena_guide_hub') {
    const hub = buildGuideHubContainer(guild, user, prefix);
    return cv2.respond(interaction, hub, 7).catch(() => null);
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

    const initialContainer = buildThinkingContainer(
      `Athena Prime is scanning module architecture & system domain...`,
      `Reading deep-dive specifications and real source files...`
    );

    await cv2.edit(interaction, {
      components: [initialContainer],
      flags: MessageFlags.IsComponentsV2
    }).catch(() => null);

    const progress = createProgressHandler(interaction);

    let aiResult;
    try {
      aiResult = await generateAthenaGuideResponse(query, {
        guild,
        user,
        prefix,
        onProgress: progress.onProgress
      });
    } finally {
      progress.stop();
    }

    const container = buildAthenaGuideContainer(user, query, aiResult, accentColor, prefix);
    return cv2.edit(interaction, { components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
  }

  if (customId === 'athena_topic_help') {
    const { buildHelpContainer } = await import('./utility.js');
    const helpContainer = buildHelpContainer(interaction.client, guild?.id, 'home');
    return cv2.respond(interaction, { components: [helpContainer], flags: MessageFlags.IsComponentsV2 }, 7).catch(() => null);
  }
}

export default commands;
