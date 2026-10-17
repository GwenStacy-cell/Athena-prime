import { ARCHITECTURE_TOPICS, COMMAND_EXPLAINERS } from './explainerRegistry.js';
import { helpModules } from '../commands/utility.js';
import { generateAIResponse, formatAIToGreyMarkdown } from './ai.js';
import { searchCodebase, formatCodebaseContext } from './codebaseKnowledge.js';
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
  const codeSnippets = await searchCodebase(cleanPrompt, { maxSnippets: 4, snippetLines: 40 });
  const codeContext = formatCodebaseContext(codeSnippets);

  // 2. Build the persona and instruction prompt
  const systemInstructions = [
    'You are Athena Prime, the sovereign AI security assistant, bot specialist, and protector for Discord servers.',
    'Your goal is to answer questions about Athena Prime, explain bot commands, clarify doubts, and instruct the user with 100% accurate, concise, straightforward instructions based directly on the bot repository source code.',
    '',
    'CRITICAL BOT CODEBASE & TRUTH RULES:',
    '- Ground every command, feature, parameter, option, and theme STRICTLY in the provided BOT SOURCE CODE and Ground Truth Knowledge Base.',
    '- Read the provided source code snippets carefully before answering. Look at the exact command options, choices, parameters, and descriptions.',
    '- If the user asks whether a specific theme, option, or feature is available (e.g. "Athena god of war theme available right?"):',
    '  • Check the source code: in src/commands/leveling.js line 274, `!ranktheme athena` is explicitly the "Sleek Obsidian & God of War stone card" (and `!profile` is also an official God of War card). State clearly that YES, the God of War theme is available as the `athena` theme via `!ranktheme athena`.',
    '  • The other available theme is `!ranktheme hogwarts` (cinematic animated GIF).',
    '  • If a user asks about a feature that is completely absent from the codebase, honestly state that it is not available. NEVER invent fake commands or recommend the wrong argument (such as claiming `!ranktheme hogwarts` is God of War).',
    '- For enabling server security or full antinuke protection, the ONE and ONLY short, straightforward, master command is `' + prefix + 'security enable all`. Do NOT give manual channel configuration steps.',
    '- NEVER hallucinate, invent, or suggest fake subcommands (such as `!setup security`, `!setup security logs`, `!setup security quarantine`, `!setup security bind`, `!antinuke config`, `!scanserver`, etc.). If a command is not in the Ground Truth or Source Code, DO NOT mention it.',
    '',
    'SECURITY & ANTINUKE GROUND TRUTH:',
    '- The Master Command: `' + prefix + 'security enable all` (Clearance: Server Owner / Extra Owner).',
    '- What it does in 1 click: Automatically deploys 100% bulletproof protection across the server:',
    '  • Creates and assigns unbypassable backup admin roles (`Athena Unbypassable` and `Athena Firewall`) so rogue admins cannot remove or strip Athena\'s admin powers.',
    '  • Automatically generates `#athenas-dashboard` for live monitoring and quick toggles.',
    '  • Automatically activates and binds `#security-logs` for audit forensics.',
    '  • Activates ALL 28 antinuke modules (Anti-Ban, Anti-Kick, Anti-Channel Delete/Create/Update, Anti-Role Delete/Create/Update, Anti-Bot Add, Anti-Webhook, Anti-Member Purge, Anti-Linked Role, etc.).',
    '  • Sets instant ban punishment on threshold 1 (zero tolerance), plus anti-invite, anti-link, anti-spam, and AI toxicity/doxxing shields.',
    '- Role Hierarchy Prerequisite: Athena\'s highest role must be placed among the Top 3 highest roles in Discord Server Settings so she can override rogue admins.',
    '- Management & Whitelisting:',
    '  • `' + prefix + 'security status` (or `' + prefix + 'ss`): Inspect live shield status and active modules.',
    '  • `' + prefix + 'whitelist @user` or `' + prefix + 'whitelist @role`: Give trusted staff immunity.',
    '  • `' + prefix + 'botwhitelist add <bot_id>`: Whitelist authorized bots.',
    '  • `' + prefix + 'security disable all`: Turn off security (requires 2FA email verification).',
    '',
    'Tone & Style Rules:',
    '- Speak directly in first-person as Athena Prime ("I am designed to...", "Here is the direct, straightforward method...").',
    '- Be concise, straightforward, authoritative, and helpful. Avoid unnecessary fluff or bloated steps.',
    '- Always prefix every line with "-# " for Discord small grey font.',
    '- Highlight key headings, commands, and steps using grey bold and underline: "-# **__Master Command:__** `' + prefix + 'security enable all`".',
    '- Never output horizontal rules, dashed underlines, or divider lines (DO NOT use "---", "===", or "-----").',
    '- Never use Discord native unicode emojis (no checkmarks, crosses, warning signs). Only use standard bullet characters or clean text.',
    '- Complete all sentences cleanly. Never cut off or truncate.',
    '',
    codeContext ? codeContext + '\n' : '',
    'Ground Truth Knowledge Base (Current Live State):',
    knowledge.rawContext
  ].join('\n');

  // 3. Delegate to neural engine
  const fullPrompt = `User's Question / Need: ${cleanPrompt}\n\nPlease read the provided bot source code and knowledge base carefully, and explain, clarify, and provide accurate instructions on how to accomplish this with Athena Prime.`;
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
function buildDeterministicGuide(prompt, knowledge, prefix, codeSnippets = []) {
  const cleanPrompt = (prompt || '').toLowerCase();
  if (cleanPrompt.includes('god of war')) {
    return [
      `**__God of War Theme Availability__**`,
      `• **Availability:** Yes! The God of War aesthetic is fully available in Athena Prime.`,
      `• **Rank Theme:** \`${prefix}ranktheme athena\` (or \`classic\`) \u2014 Switches to the sleek Obsidian & God of War stone card aesthetic.`,
      `• **Profile Card:** \`${prefix}profile\` (or \`!card\`) \u2014 Renders an official God of War canvas profile card displaying your level, voice activity, and server stats.`,
      `• **Alternative Theme:** \`${prefix}ranktheme hogwarts\` \u2014 Cinematic Animated Looping GIF with soaring Hedwig owl & flaming altar.`
    ].join('\n');
  }

  if (cleanPrompt.includes('rank theme') || cleanPrompt.includes('ranktheme') || (cleanPrompt.includes('rank') && cleanPrompt.includes('theme'))) {
    return [
      `**__Available Rank Card Themes__**`,
      `• **Theme 1:** \`${prefix}ranktheme athena\` (or \`classic\`) \u2014 Sleek Obsidian & God of War stone card.`,
      `• **Theme 2:** \`${prefix}ranktheme hogwarts\` \u2014 Cinematic Animated Looping GIF with soaring Hedwig owl & flaming altar.`,
      `• **Switch Command:** \`${prefix}ranktheme <hogwarts|athena>\``
    ].join('\n');
  }

  if (cleanPrompt.includes('security') || cleanPrompt.includes('antinuke') || cleanPrompt.includes('anti-nuke') || cleanPrompt.includes('protect') || cleanPrompt.includes('bulletproof')) {
    return [
      `**__Enabling 100% Bulletproof Server Security & Antinuke__**`,
      `• **__Master Command:__** \`${prefix}security enable all\` (Clearance: \`Server Owner / Extra Owner\`)`,
      `• **__Fast One-Click Deployment:__** You do not need to configure channels manually. Running \`${prefix}security enable all\` executes an automated sequence that activates ALL server defenses simultaneously:`,
      `  1. Creates and binds persistence backup roles (\`Athena Unbypassable\` and \`Athena Firewall\`) to prevent rogue admins from stripping Athena's administrative authority.`,
      `  2. Automatically deploys \`#athenas-dashboard\` with real-time defense status and interactive shield controls.`,
      `  3. Automatically binds and activates \`#security-logs\` for forensic audit trails.`,
      `  4. Activates ALL 28 antinuke modules (Anti-Ban, Anti-Kick, Anti-Channel Delete/Create, Anti-Role Delete/Create, Anti-Bot Add, Anti-Webhook, Anti-Member Purge, Anti-Linked Role, etc.).`,
      `  5. Sets 100% zero-tolerance enforcement: threshold 1, instant ban punishment, anti-invite, anti-link, anti-spam, and AI toxicity/doxxing shields.`,
      `• **__Prerequisite:__** Place Athena's bot role among the **Top 3 highest roles** in Discord Server Settings (Role Hierarchy) so she can override rogue admin actions.`,
      `• **__Management & Whitelist:__**`,
      `  • \`${prefix}security status\` (or \`${prefix}ss\`): Inspect live shield status.`,
      `  • \`${prefix}whitelist @user\` / \`${prefix}whitelist @role\`: Grant trusted staff immunity.`,
      `  • \`${prefix}botwhitelist add <bot_id>\`: Whitelist authorized bots.`,
      `  • \`${prefix}security disable all\`: Disable security (protected by 2FA email verification).`
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
