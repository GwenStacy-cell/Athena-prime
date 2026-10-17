import { ARCHITECTURE_TOPICS, COMMAND_EXPLAINERS } from './explainerRegistry.js';
import { helpModules } from '../commands/utility.js';
import { generateAIResponse, formatAIToGreyMarkdown } from './ai.js';
import db from '../database.js';
import cv2 from '../cv2.js';

const TICK = '<a:atheNATICK:1557841381630681106>';
const UPTIME = '<a:uptime:1552608831060844575>';

/**
 * Searches the live command explainers, architecture deep-dives, and categorized help modules
 * to extract authoritative ground truth for any user query or doubt.
 */
export function findRelevantKnowledge(query = '', prefix = '!') {
  const cleanQuery = query.toLowerCase().trim();
  const tokens = cleanQuery.split(/\s+/).filter(t => t.length > 2);

  const matchedCommands = [];
  const matchedTopics = [];
  const matchedModules = [];

  // 1. Search COMMAND_EXPLAINERS
  for (const [cmdKey, cmdData] of Object.entries(COMMAND_EXPLAINERS)) {
    let score = 0;
    const nameMatch = cmdData.name.toLowerCase() === cleanQuery || (cmdData.aliases || []).some(a => a.toLowerCase() === cleanQuery);
    if (nameMatch) score += 20;

    for (const token of tokens) {
      if (cmdData.name.toLowerCase().includes(token)) score += 8;
      if ((cmdData.aliases || []).some(a => a.toLowerCase().includes(token))) score += 5;
      if (cmdData.purpose && cmdData.purpose.toLowerCase().includes(token)) score += 3;
      if (cmdData.architecture && cmdData.architecture.toLowerCase().includes(token)) score += 3;
      if (cmdData.category && cmdData.category.toLowerCase().includes(token)) score += 2;
    }

    if (score > 0) {
      matchedCommands.push({ ...cmdData, score });
    }
  }

  // 2. Search ARCHITECTURE_TOPICS
  for (const [topicKey, topicData] of Object.entries(ARCHITECTURE_TOPICS)) {
    let score = 0;
    const keyMatch = topicKey.toLowerCase() === cleanQuery || (topicData.aliases || []).some(a => a.toLowerCase() === cleanQuery);
    if (keyMatch) score += 20;

    for (const token of tokens) {
      if (topicKey.toLowerCase().includes(token)) score += 8;
      if (topicData.label.toLowerCase().includes(token)) score += 6;
      if ((topicData.aliases || []).some(a => a.toLowerCase().includes(token))) score += 5;
      if (topicData.description && topicData.description.toLowerCase().includes(token)) score += 4;
      for (const page of topicData.pages || []) {
        if (page.pageTitle.toLowerCase().includes(token)) score += 3;
        if (page.content.toLowerCase().includes(token)) score += 1;
      }
    }

    if (score > 0) {
      matchedTopics.push({ ...topicData, score });
    }
  }

  // 3. Search helpModules for broader category guidance
  for (const mod of helpModules) {
    let score = 0;
    for (const token of tokens) {
      if (mod.id.toLowerCase().includes(token)) score += 5;
      if (mod.shortLabel.toLowerCase().includes(token)) score += 4;
      if (mod.label.toLowerCase().includes(token)) score += 3;
      for (const cmdLine of mod.commands) {
        if (cmdLine.toLowerCase().includes(token)) score += 2;
      }
    }
    if (score > 0) {
      matchedModules.push({ ...mod, score });
    }
  }

  // Sort by score
  matchedCommands.sort((a, b) => b.score - a.score);
  matchedTopics.sort((a, b) => b.score - a.score);
  matchedModules.sort((a, b) => b.score - a.score);

  // Compile synthesized live context
  const contextLines = [];

  contextLines.push('=== ATHENA PRIME SYSTEM KNOWLEDGE BASE (GROUND TRUTH) ===');
  contextLines.push(`Command Prefix for this server: "${prefix}"`);
  contextLines.push('');

  // Add top matched commands
  if (matchedCommands.length > 0) {
    contextLines.push('--- RELEVANT BOT COMMANDS ---');
    for (const cmd of matchedCommands.slice(0, 5)) {
      contextLines.push(`Command: ${prefix}${cmd.name} (Aliases: ${(cmd.aliases || []).map(a => prefix + a).join(', ') || 'None'})`);
      contextLines.push(`Category: ${cmd.category} | Clearance: ${cmd.clearance}`);
      contextLines.push(`Syntax: ${cmd.syntax.replace(/!/g, prefix)}`);
      contextLines.push(`Purpose: ${cmd.purpose}`);
      if (cmd.architecture) contextLines.push(`Under-the-Hood Architecture:\n${cmd.architecture}`);
      if (cmd.example) contextLines.push(`Example Usage: ${cmd.example.replace(/!/g, prefix)}`);
      contextLines.push('');
    }
  }

  // Add top matched architecture deep-dives
  if (matchedTopics.length > 0) {
    contextLines.push('--- SYSTEM ARCHITECTURES & EXPLOIT MITIGATIONS ---');
    for (const topic of matchedTopics.slice(0, 3)) {
      contextLines.push(`Topic: ${topic.label}`);
      contextLines.push(`Summary: ${topic.description}`);
      for (const page of (topic.pages || []).slice(0, 2)) {
        contextLines.push(`[${page.pageTitle}]\n${page.content.slice(0, 1200)}...`);
      }
      contextLines.push('');
    }
  }

  // Add categorized module commands if matched
  if (matchedModules.length > 0) {
    contextLines.push('--- RELATED COMMAND MODULES ---');
    for (const mod of matchedModules.slice(0, 2)) {
      contextLines.push(`Module: ${mod.label} (${mod.category})`);
      const sampleCmds = mod.commands.filter(c => c.trim().startsWith('`')).slice(0, 6);
      contextLines.push(sampleCmds.join('\n'));
      contextLines.push('');
    }
  }

  return {
    rawContext: contextLines.join('\n'),
    matchedCommands: matchedCommands.slice(0, 5),
    matchedTopics: matchedTopics.slice(0, 3)
  };
}

/**
 * Generates an instructive, step-by-step guidance response speaking as Athena Prime
 */
export async function generateAthenaGuideResponse(userQuestion, { guild, user, prefix = '!' } = {}) {
  const startTime = Date.now();
  const cleanPrompt = (userQuestion || '').trim();

  if (!cleanPrompt) {
    return {
      success: false,
      error: 'Please provide a question or describe what you want to achieve with Athena.'
    };
  }

  // 1. Fetch live ground truth context
  const knowledge = findRelevantKnowledge(cleanPrompt, prefix);

  // 2. Build the persona and instruction prompt
  const systemInstructions = [
    'You are Athena Prime, the sovereign AI security assistant, bot specialist, and protector for Discord servers.',
    'Your goal is to answer questions about Athena Prime, explain bot commands, clarify doubts, and instruct the user step-by-step on how to handle the bot as per their needs.',
    'Tone & Persona:',
    '- Speak directly in first-person as Athena Prime ("I am designed to...", "To configure me for this...", "Here is the exact step-by-step method...").',
    '- Be instructive, structured, clear, authoritative, and helpful.',
    '- Give clear, step-by-step walkthroughs (e.g. Step 1: Run this command, Step 2: Configure this role).',
    `- Always use the server's active command prefix ("${prefix}") when suggesting commands.`,
    '- Mention the required administrator permissions or clearance tiers for commands (e.g. [Admin Tier], [Extra Owner], [Server Owner], [Public]).',
    'Formatting & Style Rules:',
    '- Always prefix every line with "-# " for Discord small grey font.',
    '- Highlight headings, steps, and key concepts using grey bold and underline: "-# **__Step 1: Heading__**" or "-# • **__Command:__** `syntax`".',
    '- Never output horizontal rules, dashed underlines, or divider lines (DO NOT use "---", "===", or "-----").',
    '- Never use Discord native unicode emojis (no checkmarks, crosses, warning signs). Only use standard bullet characters or clean text.',
    '- Complete all sentences cleanly. Never cut off or truncate.',
    '',
    'Ground Truth Knowledge Base (Current Live State):',
    knowledge.rawContext
  ].join('\n');

  // 3. Delegate to neural engine
  const fullPrompt = `User's Question / Need: ${cleanPrompt}\n\nPlease explain, clarify, and provide step-by-step instructions on how to accomplish this with Athena Prime.`;
  const aiResult = await generateAIResponse(fullPrompt, {
    customSystem: systemInstructions,
    guildId: guild?.id,
    userTag: user?.tag,
    serverName: guild?.name
  });

  if (!aiResult.success) {
    // Deterministic fallback response if external AI edge provider is unreachable
    const fallbackText = buildDeterministicGuide(cleanPrompt, knowledge, prefix);
    return {
      success: true,
      text: formatAIToGreyMarkdown(fallbackText),
      model: 'Athena Knowledge Matrix (Offline Fallback)',
      latencyMs: Math.max(12, Date.now() - startTime),
      matchedTopics: knowledge.matchedTopics
    };
  }

  return {
    success: true,
    text: formatAIToGreyMarkdown(aiResult.text),
    model: aiResult.model,
    latencyMs: Math.max(20, Date.now() - startTime),
    matchedTopics: knowledge.matchedTopics
  };
}

/**
 * Deterministic fallback builder in case all AI edge endpoints are offline
 */
function buildDeterministicGuide(prompt, knowledge, prefix) {
  const parts = [];
  parts.push(`**__Athena Prime Guidance & Command Walkthrough__**\n`);

  if (knowledge.matchedCommands.length > 0) {
    parts.push(`**__Relevant Commands:__**`);
    for (const cmd of knowledge.matchedCommands.slice(0, 3)) {
      parts.push(`• **__\`${prefix}${cmd.name}\`:__** ${cmd.purpose}`);
      parts.push(`  -# **Syntax:** \`${cmd.syntax.replace(/!/g, prefix)}\` \u00b7 **Clearance:** \`${cmd.clearance}\``);
      if (cmd.architecture) {
        parts.push(`  -# ${cmd.architecture.replace(/\n/g, ' ')}`);
      }
    }
  }

  if (knowledge.matchedTopics.length > 0) {
    parts.push(`\n**__System Architecture & Walkthrough:__**`);
    const topic = knowledge.matchedTopics[0];
    parts.push(`• **__${topic.label}:__** ${topic.description}`);
    if (topic.pages && topic.pages[0]) {
      parts.push(`  -# ${topic.pages[0].content.slice(0, 400).replace(/\n/g, ' ')}...`);
    }
  }

  parts.push(`\n**__Next Steps:__**`);
  parts.push(`• Use \`${prefix}help <command>\` or \`${prefix}explain <topic>\` to inspect deep architectural mechanics.`);

  return parts.join('\n');
}

/**
 * Builds the Interactive Guidance Hub when !athena is called without arguments
 */
export function buildGuideHubContainer(guild, user, prefix = '!') {
  const container = {
    type: 17,
    components: [
      {
        type: 10,
        content:
          `# Athena Prime System Guide & Intelligence Hub | ${TICK}\n` +
          `-# Greetings, <@${user.id}>. I am **Athena Prime**, your server's autonomous guardian and system intelligence.\n` +
          `-# Ask me anything about my **245+ commands**, server configurations, or security architectures to receive step-by-step instructions tailored to your needs.`
      },
      { type: 14, divider: true },
      {
        type: 10,
        content:
          `### **How to Ask Me Anything:**\n` +
          `> -# • \`${prefix}athena how do I set up tickets with AI triage?\`\n` +
          `> -# • \`${prefix}athena how to protect against rogue admins deleting channels?\`\n` +
          `> -# • \`${prefix}athena how to enable AI toxicity and doxxing automod?\`\n` +
          `> -# • \`${prefix}athena what does panic lockdown tier 3 do?\`\n` +
          `> -# • \`${prefix}athena how does the casino minigames economy work?\`\n` +
          `> -# • \`${prefix}athena how to setup verification with graphic captcha?\`\n\n` +
          `### **Explore Core System Domains:**\n` +
          `-# Click any quick button below for instant guidance on that feature matrix:`
      },
      { type: 14, divider: true },
      {
        type: 1,
        components: [
          { type: 2, custom_id: 'athena_topic_security', label: 'Security & Antinuke', style: 2, emoji: { id: '1523672289500069940' } },
          { type: 2, custom_id: 'athena_topic_automod', label: 'Automod & AI Toxicity', style: 2, emoji: { id: '1533844853048209489' } },
          { type: 2, custom_id: 'athena_topic_tickets', label: 'Tickets & AI Triage', style: 2, emoji: { id: '1533859896620089485' } },
          { type: 2, custom_id: 'athena_topic_minigames', label: 'Economy & Minigames', style: 2, emoji: { id: '1533859922599481577' } }
        ]
      },
      {
        type: 1,
        components: [
          { type: 2, custom_id: 'athena_topic_lockdown', label: 'Panic Lockdown', style: 4 },
          { type: 2, custom_id: 'athena_topic_learn', label: 'Heuristic Learn Mode', style: 2 },
          { type: 2, custom_id: 'athena_topic_help', label: 'Open Help Center', style: 2, emoji: { id: '1523765738655973589' } }
        ]
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: `-# **Athena Prime Autonomous Assistant Matrix \u00b7 Real-Time Ground Truth**`
      }
    ]
  };

  return { components: [container], flags: 32768 };
}

/**
 * Builds the CV2 accent borderless container for Athena Assistant responses
 */
export function buildAthenaGuideContainer(user, query, aiResult, accentColor = '#00e5ff', prefix = '!') {
  const content = formatAIToGreyMarkdown(aiResult.text || 'No instructions generated.');
  const comps = [
    {
      type: 10,
      content:
        `## Athena System Guide & Intelligence | ${TICK}\n` +
        `-# **• Member:** <@${user.id}> \u00b7 **Model:** \`${aiResult.model}\` \u00b7 **Latency:** \`${aiResult.latencyMs}ms\`\n` +
        `-# **• Question:** *${query.length > 130 ? query.slice(0, 127) + '...' : query}*`
    },
    { type: 14, divider: true }
  ];

  if (content.length <= 3800) {
    comps.push({ type: 10, content });
  } else {
    const chunks = content.match(/[\s\S]{1,3800}/g) || [content];
    for (let i = 0; i < chunks.length; i++) {
      comps.push({ type: 10, content: chunks[i] });
      if (i < chunks.length - 1) comps.push({ type: 14, divider: true });
    }
  }

  comps.push({ type: 14, divider: true });

  // Quick navigation row
  comps.push({
    type: 1,
    components: [
      { type: 2, custom_id: 'athena_guide_hub', label: 'Guidance Hub', style: 2, emoji: { id: '1523765738655973589' } },
      { type: 2, custom_id: 'arch_home', label: 'Architecture Topics', style: 2, emoji: { id: '1523766065576935475' } }
    ]
  });

  comps.push({ type: 14, divider: true });
  comps.push({
    type: 10,
    content: `-# **Athena Prime \u00b7 Autonomous Server Assistance & Intelligence Engine**`
  });

  return {
    type: 17,
    components: comps
  };
}
