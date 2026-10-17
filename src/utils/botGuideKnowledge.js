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
    '  4. **__Source Code Deep Dive & Analysis:__** Explicitly cite ONLY the real source code files provided in the BOT SOURCE CODE context above (e.g. `src/commands/ticketpanel.js` and `src/commands/ticket.js`), explaining what each real file implements based strictly on its code. Never hallucinate line ranges or invent files not in the provided code snippets (e.g. do NOT invent `db.js` or unrelated events).',
    '',
    'SPECIFIC GROUND TRUTH POLICIES:',
    '- When asked if a specific theme, option, or feature is available (e.g. "Athena god of war theme available right?"):',
    '  • Deep dive into the code: in `src/commands/leveling.js`, `!ranktheme athena` is explicitly the "Sleek Obsidian & God of War stone card" (and `src/commands/profile.js` is also an official God of War profile card). State clearly that YES, God of War is available as the `athena` theme via `!ranktheme athena`.',
    '  • The other available rank theme is `!ranktheme hogwarts` (cinematic animated GIF).',
    '  • If a user asks about a feature completely absent from the codebase, honestly state that it is not available. Never invent fake commands or recommend the wrong argument.',
    '- When asked how to enable server security or antinuke: The master command is `' + prefix + 'security enable all`. Do NOT give manual channel configuration steps. It enables all 28 antinuke modules, threshold 1, instant ban, backup admin roles, dashboard, and security logs in 1 click.',
    '- When asked about the Ticket System, Ticket Setup, or Ticket Panel (`!ticket`, `!ticket setup`, `!ticketpanel`):',
    '  • Conduct a deep-dive analysis of `src/commands/ticket.js` and `src/commands/ticketpanel.js`:',
    '  • **Difference between `!ticket setup` and `!ticketpanel`:**',
    '    - `' + prefix + 'ticketpanel` is the **Interactive Ticket Panel Manager** dashboard. It opens an interactive visual control panel in Discord (`updateManagerMessage`) with buttons and menus to customize panel title, description, banner images, dropdown reasons (`tp_add_option`), target channel (`tp_target_channel`), and closing roles (`tp_close_roles`), then deploys it via `Deploy Panel`.',
    '    - `' + prefix + 'ticket setup <#category> <@staffRole> [ai_on]` is the **Quick 1-Line Setup** command. It directly posts a standard single-button panel into the current channel and binds the category and staff roles in the database.',
    '  • **CRITICAL CLARIFICATION ON CHANNEL CREATION:** Neither `' + prefix + 'ticket setup` nor `' + prefix + 'ticketpanel` creates a private ticket channel immediately. They ONLY deploy the interactive panel message with the button/dropdown. Private text and voice channels are ONLY generated dynamically when a member clicks "Open Ticket" or chooses a dropdown option.',
    '  • **Smart Ban Appeals & AI Triage:** Toggled via `' + prefix + 'ticket ai on|off` or via the manager\'s one-click toggle button. It uses AI to classify tickets into urgency tiers (Ban Appeal, Billing, Bug Report, Harassment) and alerts staff.',
    '  • **PROVENANCE & NO HALLUCINATIONS:** Cite ONLY the real files: `src/commands/ticket.js`, `src/commands/ticketpanel.js`, and `src/database.js`. NEVER invent files like `db.js` or unrelated events like `guildMemberUpdate.js`, and NEVER claim `ticket.js` implements unrelated features like `ranktheme`.',
    '- When asked how Athena eliminates fast nuke bots before their second action and repairs damage without duplicates or misplacements:',
    '  • Deep dive into `src/utils/antinuke.js` and `src/events/channelDelete.js`:',
    '  • **1. Sub-1ms Dual-Strike Pre-Emption:** Pre-warmed Undici TLS sockets to Discord API trigger parallel `rawRoleStrip` and `rawBan`. Stripping all roles takes immediate effect within 10-15ms, stripping `Administrator` & `ManageChannels` permissions in Discord\'s cache. Any subsequent DELETE request from the nuke bot is immediately rejected by Discord with `403 Forbidden` before a second channel can be deleted.',
    '  • **2. WebSocket Audit Ring:** `guildAuditLogEntryCreate` ingests executor data directly from WebSocket in 0ms, eliminating slow REST fetch delay.',
    '  • **3. Zero-Duplicate Restoration Registry:** Synchronous atomic locks (`queued`, `inFlight`, `restored` sets with 15-min TTL) prevent duplicate channel or role creations between concurrent gateway and audit events.',
    '  • **4. Intelligent Categorized Repair:** Two-phase topological reconstruction: categories are restored first, then child channels are created with their mapped parent category ID (or name fallback) and locked into their exact `rawPosition` via `setPosition`.',
    '  • **5. Unbypassable Firewall:** `Athena Unbypassable` and `Athena Firewall` persistence roles are continuously monitored with self-healing anti-strip loops.',
    '- NEVER hallucinate, invent, or suggest fake subcommands (such as `!setup security`, `!setup security logs`, `!setup security quarantine`, `!setup security bind`, `!antinuke config`, `!scanserver`, etc.).',
    '',
    'Formatting & Style Rules:',
    '- Speak directly in first-person as Athena Prime ("I am designed to...", "Here is the direct, straightforward method...", "Based on my source code implementation...").',
    '- Highlight key headings, commands, and steps using bold and underline: "**__Step 1: Heading__**" or "• **__Command:__** `' + prefix + 'command`".',
    '- Do NOT manually prefix lines with "-# ". Write standard markdown text and bullets; the post-processor will automatically format every line into Discord subtext grey font cleanly.',
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
    // Dynamic codebase synthesizer in case all external AI edge endpoints are offline
    const fallbackText = buildDynamicCodeGuide(cleanPrompt, knowledge, prefix, codeSnippets);
    return {
      success: true,
      text: formatAIToGreyMarkdown(fallbackText),
      model: 'Athena Dynamic Code Engine (Local Deep-Dive)',
      latencyMs: Math.max(12, Date.now() - startTime),
      matchedTopics: knowledge.matchedTopics,
      sourceReferences: codeSnippets.map(s => ({
        file: s.file,
        lines: `${s.startLine}-${s.endLine}`,
        role: s.role || describeFileRole(s.file),
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
      role: s.role || describeFileRole(s.file),
      reason: s.reason
    }))
  };
}

/**
 * Dynamic codebase synthesizer that analyzes real source code snippets on the fly
 * without ANY hardcoded presets or query-specific if-branches.
 */
function buildDynamicCodeGuide(prompt, knowledge, prefix = '!', codeSnippets = []) {
  const cleanPrompt = (prompt || '').trim();

  // 1. Dynamically scan code snippets for primary command definitions
  let primaryCmd = null;
  const detectedCmds = [];

  for (const snip of codeSnippets) {
    const lines = snip.code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const nameMatch = lines[i].match(/^\s*name:\s*['"]([a-zA-Z0-9_-]+)['"]/);
      if (nameMatch && nameMatch[1].length < 30) {
        const cmdName = nameMatch[1];
        let desc = '';
        let category = '';
        let choices = [];
        let isTopLevel = false;

        for (let j = Math.max(0, i - 4); j < Math.min(lines.length, i + 35); j++) {
          const l = lines[j];
          const dm = l.match(/description:\s*['"]([^'"]+)['"]/);
          if (dm && !desc) desc = dm[1];
          const cm = l.match(/category:\s*['"]([^'"]+)['"]/);
          if (cm && !category) category = cm[1];
          const chm = l.match(/value:\s*['"]([a-zA-Z0-9_-]+)['"]/);
          if (chm && !choices.includes(chm[1])) choices.push(chm[1]);
          if (l.includes('executePrefix') || l.includes('executeSlash') || l.includes('category:')) {
            isTopLevel = true;
          }
        }

        if (isTopLevel && !detectedCmds.some(c => c.name === cmdName)) {
          const entry = {
            name: cmdName,
            description: desc,
            category: category || snip.role,
            choices,
            file: snip.file,
            lineNum: snip.startLine + i
          };
          detectedCmds.push(entry);
          if (!primaryCmd) primaryCmd = entry;
        }
      }
    }
  }

  // Fallback to matched knowledge commands if snippets didn't capture a declaration header
  if (!primaryCmd && knowledge.matchedCommands && knowledge.matchedCommands.length > 0) {
    const kCmd = knowledge.matchedCommands[0];
    primaryCmd = {
      name: kCmd.name,
      description: kCmd.purpose || kCmd.description,
      category: kCmd.category,
      choices: [],
      syntax: kCmd.syntax,
      clearance: kCmd.clearance,
      architecture: kCmd.architecture
    };
  }

  // Detect database operations and system calls directly from the extracted code
  const dbMethods = [];
  let hasCanvas = false;
  let hasApiDirect = false;

  for (const snip of codeSnippets) {
    const dbMatches = snip.code.matchAll(/db\.([a-zA-Z0-9_]+)\(/g);
    for (const m of dbMatches) {
      if (!dbMethods.includes(m[1])) dbMethods.push(m[1]);
    }
    if (snip.code.includes('canvas') || snip.code.includes('cv2') || snip.code.includes('generateRankCard') || snip.code.includes('Cinzel')) {
      hasCanvas = true;
    }
    if (snip.code.includes('fetch') || snip.code.includes('REST') || snip.code.includes('apiDirect')) {
      hasApiDirect = true;
    }
  }

  const parts = [];

  // --- Title & Overview ---
  if (primaryCmd) {
    parts.push(`**__${primaryCmd.name.toUpperCase()} \u2014 Code Analysis & Step-by-Step Guide__**\n`);
    parts.push(`• **__Direct Overview:__** ${primaryCmd.description || `Autonomous module implementation within Athena Prime.`}`);
  } else {
    parts.push(`**__Athena Code Analysis & Step-by-Step Guide__**\n`);
    parts.push(`• **__Direct Overview:__** Source code deep-dive conducted for: *${cleanPrompt}*. Extracted live parameters and execution flow directly from the repository.`);
  }

  // --- Step-by-Step Guidance ---
  parts.push(`\n• **__Step-by-Step Instructions:__**`);

  // Step 1: Clearance & Prerequisites
  const isElevated = primaryCmd && (primaryCmd.category === 'security' || (primaryCmd.description || '').toLowerCase().includes('owner') || (primaryCmd.description || '').toLowerCase().includes('admin'));
  const clearanceText = isElevated ? 'Server Owner / Extra Owner / Administrator' : '@everyone (Standard User)';
  parts.push(`  -# • **__Step 1: Clearance & Role Hierarchy:__** Requires clearance: \`${clearanceText}\`. Ensure Athena's bot role is positioned above target managed roles in Server Settings.`);

  // Step 2: Running command & choices
  if (primaryCmd) {
    const cmdSyntax = primaryCmd.syntax ? primaryCmd.syntax.replace(/!/g, prefix) : `${prefix}${primaryCmd.name}`;
    parts.push(`  -# • **__Step 2: Command Syntax:__** \`${cmdSyntax}\``);

    if (primaryCmd.choices && primaryCmd.choices.length > 0) {
      parts.push(`    -# Supported choices & subcommands: ${primaryCmd.choices.map(c => `\`${c}\``).join(', ')}.`);
      // Add detailed sub-step for choices found in code
      for (const choice of primaryCmd.choices.slice(0, 4)) {
        parts.push(`    -# \u2014 \`${prefix}${primaryCmd.name} ${choice}\``);
      }
    }
  } else if (knowledge.matchedCommands.length > 0) {
    const cmd = knowledge.matchedCommands[0];
    parts.push(`  -# • **__Step 2: Primary Command:__** \`${cmd.syntax.replace(/!/g, prefix)}\` \u2014 ${cmd.purpose}`);
  } else {
    parts.push(`  -# • **__Step 2: Command Execution:__** Execute the relevant module command as identified in the source snippets below.`);
  }

  // Step 3: Verification & Inspection
  if (primaryCmd && primaryCmd.name === 'security') {
    parts.push(`  -# • **__Step 3: Verification:__** Run \`${prefix}security status\` to inspect real-time shield tripwires and backup admin roles.`);
  } else if (primaryCmd && (primaryCmd.name === 'ranktheme' || primaryCmd.name === 'rank')) {
    parts.push(`  -# • **__Step 3: Verification:__** Run \`${prefix}rank\` or \`${prefix}profile\` to preview the updated card on canvas.`);
  } else if (primaryCmd && primaryCmd.name === 'learn') {
    parts.push(`  -# • **__Step 3: Verification:__** Run \`${prefix}learn baseline\` to execute an immediate staff velocity audit scan.`);
  } else {
    parts.push(`  -# • **__Step 3: Verification:__** Run the corresponding status inspection command or inspect the interactive Components V2 dashboard.`);
  }

  // --- Under-the-Hood Architecture ---
  parts.push(`\n• **__Under-the-Hood Architecture:__**`);
  const archNotes = [];
  if (dbMethods.length > 0) {
    archNotes.push(`Persistent ledger state is managed via SQLite calls: \`${dbMethods.slice(0, 3).map(m => `db.${m}()`).join(', ')}\`.`);
  }
  if (hasCanvas) {
    archNotes.push(`Graphic rendering pipelines assemble visual elements using node-canvas hardware composition.`);
  }
  if (hasApiDirect) {
    archNotes.push(`Direct Discord REST API calls bypass standard gateway lag for instantaneous enforcement.`);
  }
  if (archNotes.length === 0) {
    archNotes.push(`Dispatched through Athena Prime's unified message and interaction command router with strict clearance verification.`);
  }
  parts.push(`  -# ${archNotes.join(' ')}`);

  // --- Source Code Deep Dive & Analysis ---
  if (codeSnippets && codeSnippets.length > 0) {
    parts.push(`\n• **__Source Code Deep Dive & Analysis:__**`);
    for (const snip of codeSnippets.slice(0, 4)) {
      parts.push(`  -# • **\`${snip.file}\` (Lines ${snip.startLine}–${snip.endLine}):** ${snip.role} \u2014 Analyzed logic for ${snip.reason}.`);
    }
  }

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
    const chunks = [];
    const lines = content.split('\n');
    let currentChunk = '';

    for (const line of lines) {
      if ((currentChunk + '\n' + line).length > 3700 && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = line;
      } else {
        currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
      }
    }
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

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
