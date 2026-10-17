import { ARCHITECTURE_TOPICS, COMMAND_EXPLAINERS } from './explainerRegistry.js';
import { helpModules } from '../commands/utility.js';
import { generateAIResponse, formatAIToGreyMarkdown } from './ai.js';
import { searchCodebase, formatCodebaseContext, describeFileRole } from './codebaseKnowledge.js';
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
  const isSecurityQuery = cleanQuery.includes('security') || cleanQuery.includes('antinuke') || cleanQuery.includes('anti-nuke') || cleanQuery.includes('protect') || cleanQuery.includes('bulletproof') || cleanQuery.includes('defense') || cleanQuery.includes('defend');

  const matchedCommands = [];
  const matchedTopics = [];
  const matchedModules = [];

  // 1. Search COMMAND_EXPLAINERS
  for (const [cmdKey, cmdData] of Object.entries(COMMAND_EXPLAINERS)) {
    let score = 0;
    const nameMatch = cmdData.name.toLowerCase() === cleanQuery || (cmdData.aliases || []).some(a => a.toLowerCase() === cleanQuery);
    if (nameMatch) score += 20;

    if (isSecurityQuery) {
      if (cmdData.name === 'security' || cmdData.name === 'antinuke') score += 100;
      if (cmdData.name === 'setup') score -= 50; // Channel binding !setup is not the security enable command
    }

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

  // 1. Fetch live ground truth context and search real codebase
  const knowledge = findRelevantKnowledge(cleanPrompt, prefix);
  const codeSnippets = await searchCodebase(cleanPrompt, { maxSnippets: 5, snippetLines: 45 });
  const codeContext = formatCodebaseContext(codeSnippets);

  // 2. Build the persona and instruction prompt
  const systemInstructions = [
    'You are Athena Prime, the sovereign AI security assistant, bot specialist, and protector for Discord servers.',
    'Your goal is to answer questions about Athena Prime by conducting a thorough deep-dive analysis of the bot\'s codebase, and providing a fully prepared, comprehensive step-by-step output to help the user.',
    '',
    'CRITICAL SOURCE CODE PROVENANCE & DEEP DIVE RULES:',
    '- Ground every command, feature, parameter, option, and theme STRICTLY in the provided BOT SOURCE CODE and Ground Truth Knowledge Base.',
    '- Conduct a deep-dive analysis into the provided source code, explaining both the user-facing command instructions AND the underlying code architecture.',
    '- You MUST ALWAYS include a dedicated section at the end of your response explicitly citing where in the source code you deep-dived and analyzed the answer from, including file paths and line ranges.',
    '- Structure your response clearly with these sections:',
    '  1. **__Direct Overview:__** Direct, authoritative answer explaining the capability or answering the user\'s question.',
    '  2. **__Step-by-Step Instructions:__** Actionable, numbered step-by-step guidance on how to use, configure, or toggle the feature (e.g. Step 1: Requirements & Clearance, Step 2: Running command, Step 3: Options & verification).',
    '  3. **__Under-the-Hood Architecture:__** Deep technical breakdown of how the engine operates behind the scenes (database persistence, Discord REST API, canvas rendering, audit logs, etc.).',
    '  4. **__Source Code Deep Dive & Analysis:__** Explicitly list each source code file and line range where you analyzed and derived the answer from, explaining what that file implements (e.g. `-# • **\`src/commands/leveling.js\` (Lines 248–293):** Implements the \`ranktheme\` command definition, choices, and database persistence hook.`).',
    '',
    'SPECIFIC GROUND TRUTH POLICIES:',
    '- When asked if a specific theme, option, or feature is available (e.g. "Athena god of war theme available right?"):',
    '  • Deep dive into the code: in `src/commands/leveling.js`, `!ranktheme athena` is explicitly the "Sleek Obsidian & God of War stone card" (and `src/commands/profile.js` is also an official God of War profile card). State clearly that YES, God of War is available as the `athena` theme via `!ranktheme athena`.',
    '  • The other available rank theme is `!ranktheme hogwarts` (cinematic animated GIF).',
    '  • If a user asks about a feature completely absent from the codebase, honestly state that it is not available. Never invent fake commands or recommend the wrong argument.',
    '- When asked how to enable server security or antinuke: The master command is `' + prefix + 'security enable all`. Do NOT give manual channel configuration steps. It enables all 28 antinuke modules, threshold 1, instant ban, backup admin roles, dashboard, and security logs in 1 click.',
    '- NEVER hallucinate, invent, or suggest fake subcommands (such as `!setup security`, `!setup security logs`, `!setup security quarantine`, `!setup security bind`, `!antinuke config`, `!scanserver`, etc.).',
    '',
    'Formatting & Style Rules:',
    '- Speak directly in first-person as Athena Prime ("I am designed to...", "Here is the direct, straightforward method...", "Based on my source code implementation...").',
    '- Always prefix every line with "-# " for Discord small grey font.',
    '- Highlight key headings, commands, and steps using grey bold and underline: "-# **__Step 1: Heading__**" or "-# • **__Command:__** `' + prefix + 'command`".',
    '- Never output horizontal rules, dashed underlines, or divider lines (DO NOT use "---", "===", or "-----").',
    '- Never use Discord native unicode emojis (no checkmarks, crosses, warning signs). Only use standard bullet characters or clean text.',
    '- Complete all sentences cleanly. Never cut off or truncate.',
    '',
    codeContext ? codeContext + '\n' : '',
    'Ground Truth Knowledge Base (Current Live State):',
    knowledge.rawContext
  ].join('\n');

  // 3. Delegate to neural engine
  const fullPrompt = `User's Question / Need: ${cleanPrompt}\n\nPlease read the provided bot source code and knowledge base carefully, and explain, clarify, and provide a comprehensive deep-dive response with step-by-step instructions and source code references on how to accomplish this with Athena Prime.`;
  const aiResult = await generateAIResponse(fullPrompt, {
    customSystem: systemInstructions,
    guildId: guild?.id,
    userTag: user?.tag,
    serverName: guild?.name
  });

  if (!aiResult.success) {
    // Deterministic fallback response if external AI edge provider is unreachable
    const fallbackText = buildDeterministicGuide(cleanPrompt, knowledge, prefix, codeSnippets);
    return {
      success: true,
      text: formatAIToGreyMarkdown(fallbackText),
      model: 'Athena Knowledge Matrix (Offline Fallback)',
      latencyMs: Math.max(12, Date.now() - startTime),
      matchedTopics: knowledge.matchedTopics,
      sourceReferences: codeSnippets.map(s => ({
        file: s.file,
        lines: `${s.startLine}-${s.endLine}`,
        role: describeFileRole(s.file),
        reason: s.reason
      }))
    };
  }

  return {
    success: true,
    text: formatAIToGreyMarkdown(aiResult.text),
    model: aiResult.model,
    latencyMs: Math.max(20, Date.now() - startTime),
    matchedTopics: knowledge.matchedTopics,
    sourceReferences: codeSnippets.map(s => ({
      file: s.file,
      lines: `${s.startLine}-${s.endLine}`,
      role: describeFileRole(s.file),
      reason: s.reason
    }))
  };
}

/**
 * Deterministic fallback builder in case all AI edge endpoints are offline
 */
function buildDeterministicGuide(prompt, knowledge, prefix, codeSnippets = []) {
  const cleanPrompt = (prompt || '').toLowerCase();
  
  let srcCitation = '';
  if (codeSnippets && codeSnippets.length > 0) {
    const lines = [
      '',
      `• **__Source Code Deep Dive & Analysis:__**`
    ];
    for (const snip of codeSnippets.slice(0, 3)) {
      const role = describeFileRole(snip.file);
      lines.push(`  -# • \`${snip.file}\` (Lines ${snip.startLine}–${snip.endLine}) — ${role} (${snip.reason})`);
    }
    srcCitation = lines.join('\n');
  }

  if (cleanPrompt.includes('god of war')) {
    return [
      `**__God of War Theme Availability & Deep-Dive Analysis__**`,
      `• **Availability:** Yes! The God of War aesthetic is fully implemented and available in Athena Prime.`,
      `• **__Step 1: Choose Your Aesthetic__**`,
      `  -# To switch your rank card to the God of War stone card, use: \`${prefix}ranktheme athena\` (or \`${prefix}ranktheme classic\`).`,
      `  -# To switch to the animated fantasy theme instead, use: \`${prefix}ranktheme hogwarts\`.`,
      `• **__Step 2: Preview Your Card__**`,
      `  -# Run \`${prefix}rank\` to generate and view your active XP card.`,
      `• **__Step 3: God of War Profile Card__**`,
      `  -# Run \`${prefix}profile\` (or \`${prefix}card\`) to render the full-scale God of War canvas card with levels, voice, and stats.`,
      `• **__Under-the-Hood Architecture:__**`,
      `  -# The theme selection is atomically saved in SQLite via \`db.setUserRankTheme(userId, theme)\`. When \`!rank\` is called, the canvas engine queries this ledger and renders the card with Cinzel stone typography.`,
      srcCitation || `  -# • \`src/commands/leveling.js\` (Lines 248–293) — \`ranktheme\` command definition & God of War stone card selection.`
    ].join('\n');
  }

  if (cleanPrompt.includes('rank theme') || cleanPrompt.includes('ranktheme') || (cleanPrompt.includes('rank') && cleanPrompt.includes('theme'))) {
    return [
      `**__Available Rank Card Themes & Deep Dive__**`,
      `• **Theme 1:** \`${prefix}ranktheme athena\` (or \`classic\`) — Sleek Obsidian & God of War stone card.`,
      `• **Theme 2:** \`${prefix}ranktheme hogwarts\` — Cinematic Animated Looping GIF with soaring Hedwig owl & flaming altar.`,
      `• **Switch Command:** \`${prefix}ranktheme <hogwarts|athena>\``,
      `• **Under-the-Hood Architecture:**`,
      `  -# Persists your chosen theme in the \`userRankThemes\` table. Looping GIFs are encoded via a 12-frame 10 FPS palettegen pipeline; the Athena theme uses Cinzel God of War stone rendering.`,
      srcCitation || `  -# • \`src/commands/leveling.js\` (Lines 248–293) — Declares \`ranktheme\` with choices and handles theme persistence.`
    ].join('\n');
  }

  if (cleanPrompt.includes('security') || cleanPrompt.includes('antinuke') || cleanPrompt.includes('anti-nuke') || cleanPrompt.includes('protect') || cleanPrompt.includes('bulletproof')) {
    return [
      `**__Enabling 100% Bulletproof Server Security & Antinuke__**`,
      `• **__Master Command:__** \`${prefix}security enable all\` (Clearance: \`Server Owner / Extra Owner\`)`,
      `• **__Step 1: Role Hierarchy Prerequisite__**`,
      `  -# Place Athena's bot role among the **Top 3 highest roles** in Discord Server Settings so she has administrative authority over rogue admins.`,
      `• **__Step 2: Execute Master Deployment__**`,
      `  -# Type \`${prefix}security enable all\`. Athena runs an automated sequence that activates ALL server defenses simultaneously:`,
      `    1. Creates & binds backup admin roles (\`Athena Unbypassable\`, \`Athena Firewall\`).`,
      `    2. Deploys \`#athenas-dashboard\` with real-time controls.`,
      `    3. Binds \`#security-logs\` for audit forensics.`,
      `    4. Activates ALL 28 antinuke modules on threshold 1 with instant ban punishment.`,
      `    5. Enables anti-invite, anti-link, anti-spam, and AI toxicity/doxxing shields.`,
      `• **__Step 3: Verification & Whitelisting__**`,
      `  -# Type \`${prefix}security status\` (or \`${prefix}ss\`) to inspect active shields.`,
      `  -# Whitelist trusted staff: \`${prefix}whitelist @user\` / \`${prefix}whitelist @role\`.`,
      `  -# Whitelist approved bots: \`${prefix}botwhitelist add <bot_id>\`.`,
      srcCitation || `  -# • \`src/commands/security.js\` (Lines 1510–1534 & 4180–4220) — Master sequence & 28-module zero-tolerance enforcer.`
    ].join('\n');
  }

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
  const sources = aiResult.sourceReferences || [];
  const sourceLine = sources.length > 0 
    ? `\n-# **• Codebase Deep Dive:** ${sources.map(s => `\`${s.file.replace(/^src\//, '')}#L${s.lines}\``).slice(0, 3).join(', ')}` 
    : '';

  const comps = [
    {
      type: 10,
      content:
        `## Athena System Guide & Intelligence | ${TICK}\n` +
        `-# **• Member:** <@${user.id}> \u00b7 **Model:** \`${aiResult.model}\` \u00b7 **Latency:** \`${aiResult.latencyMs}ms\`\n` +
        `-# **• Question:** *${query.length > 130 ? query.slice(0, 127) + '...' : query}*${sourceLine}`
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
