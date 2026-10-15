/**
 * Comprehensive Architectural & Command Explainer Registry for Athena Prime.
 * Provides granular, in-depth architectural breakdowns, zero-day exploit analysis,
 * and under-the-hood mechanics for all modules and commands.
 */

export const ARCHITECTURE_TOPICS = {
  security: {
    id: 'security',
    label: 'Security & Exploit Defense',
    aliases: ['antinuke', 'firewall', 'roleexploit', 'linkedroles', 'linkedrole', 'exploit', 'defense', 'sentinel'],
    title: 'Security & Zero-Day Exploit Defense Architecture | <a:atheNATICK:1557841381630681106>',
    description: 'Autonomous zero-day exploit mitigation, Linked Role interception, and raw API defense mechanics.',
    pages: [
      {
        pageTitle: 'Linked Role Exploit Analysis & The 60s Solution',
        content: 
`# 1. What is a "Linked Role"?
Discord has a built-in feature called **Linked Roles (Connections)**. Server administrators can set verification requirements on a role (such as having a connected Steam account with game hours, Reddit karma, YouTube, Twitter/X, GitHub, domain verification, etc.). When a member connects that account, Discord's internal system automatically grants the role to the member.

# 2. Why is this an exploit vector?
• When a moderator or bot gives someone a role, Discord logs an entry in the **Server Audit Log** (\`AuditLogEvent.MemberRoleUpdate\`) showing who gave the role.
• When Discord assigns a Linked Role, **NO AUDIT LOG ENTRY is created by an executor** (there is no moderator or bot recorded; executor is empty/null).
• **The Exploit:** If an unauthorized admin, a compromised bot, or a rogue setup configures a role with **Administrator** (or other dangerous permissions like \`Manage Server\`, \`Manage Roles\`, \`Ban Members\`, \`Manage Channels\`, etc.) as a Linked Role, any member can connect their account and self-claim Administrator permissions with zero audit log footprint.
• Standard antinuke bots that only monitor Audit Logs never see an event and fail to intervene, allowing the attacker to acquire Administrator privileges and nuke the server unnoticed.

# 3. The 60-Second Threshold Solution
As designed for Athena Prime:
• When a member receives an \`Administrator\` or dangerous role (\`guildMemberUpdate\`), check the audit logs immediately.
• If under a **60-second threshold** there is no audit log entry (or the executor is empty/self-assigned), it is identified as an unauthorized **Linked Role Exploit**.
• The bot must immediately strip the role, disarm the role's permissions, quarantine the user, and notify the Server Owner.`
      },
      {
        pageTitle: 'Real-Time Interceptor & Execution Systems',
        content:
`# Real-Time Role Interceptor (\`src/events/guildMemberUpdate.js\`)
• **Trigger:** Fires dynamically whenever any member's roles change.
• **Checks:** Scans if the user gained any dangerous permission (\`Administrator\`, \`Manage Server\`, \`Manage Roles\`, \`Manage Channels\`, \`Ban Members\`, \`Kick Members\`, \`Manage Webhooks\`, \`Mention Everyone\`, or configured Admin Tier roles).
• **Exemption Matrix:** Skips only the Server Owner, Bot Owner, and Extra Owners.
• **60-Second Audit Log Cross-Examination:**
  1. Scans audit logs for an authorized \`MemberRoleUpdate\` within the last 60 seconds.
  2. If no audit log exists, or if the executor is empty/self-assigned, or if the executor is unauthorized:
     • **Instant Role Strip:** Immediately strips the dangerous role(s) from the member via direct Discord REST API.
     • **Disarms Compromised Role:** Revokes dangerous permissions from the role so no other user can exploit it via linked connection.
     • **Quarantine Containment:** Automatically places the exploiter into Quarantine isolation.
     • **Security Log & Owner Alert:** Dispatches a high-priority alert container to the server's security channel and DMs the Server Owner directly.

# God-Tier Execution Engine
• **Raw WebSocket Wiretap:** Sub-millisecond (<1ms) event processing guarantees strikes occur before attackers can broadcast nuke payloads.
• **10ms API Polling:** Continual verification ensuring zero unlogged bypasses or gateway drops.`
      },
      {
        pageTitle: 'Onboarding Guard & Sentinel Role Hierarchy',
        content:
`# Join-Time & Onboarding Guard (\`src/events/guildMemberAdd.js\` & \`src/utils/onboardingGuard.js\`)
• **Trigger:** Real-time inspection upon member join & proactive Onboarding prompt audit.
• **Exploit Vectors Mitigated:** Neutralizes Discord Onboarding & pre-linked role exploits if roles carry \`Administrator\`, \`Manage Server\`, \`Manage Roles\`, \`Ban Members\`, \`Kick Members\`, etc.
• **Onboarding REST Sanitization:** Proactively queries Discord Guild Onboarding endpoints, scans prompt options for dangerous roles, excises dangerous roles from prompts, disarms permissions, and quarantines unauthorized holders.

# Persistence Sentinel Role Engine (\`src/utils/antiStrip.js\`)
• **Command:** \`!unbypassable\` / \`/unbypassable\`
• **Aliases:** \`!unb\`, \`!persistenceroles\`, \`!sentinels\`
• **Access Clearance:** Administrators, Server Owner, Extra Owners, and Bot Owners.
• **Role Hierarchy Positioning:** Establishes \`Athena Unbypassable\` and \`Athena Firewall\` directly below the bot's integration role.
• **Self-Healing Loop:** Automatically re-creates and heals sentinel roles if deleted, stripped, or tampered with by unauthorized staff.`
      }
    ]
  },

  unbypassable: {
    id: 'unbypassable',
    label: 'Persistence Sentinel Roles',
    aliases: ['unb', 'sentinels', 'persistenceroles', 'persist', 'sentinel'],
    title: 'Persistence Sentinel Role Hierarchy & Self-Healing | <a:atheNATICK:1557841381630681106>',
    description: 'Top-tier administrative persistence sentinel roles and self-healing hierarchy safeguards.',
    pages: [
      {
        pageTitle: 'Sentinel Roles Architecture & Hierarchy',
        content:
`# Persistence Sentinel Role Mechanics
Discord enforces strict role hierarchy mechanics:
• A bot can only assign, strip, or modify roles that are positioned strictly **below** its highest integration role.
• If an attacker creates an elevated role above existing moderators, traditional bots become powerless.

# The Athena Sentinel Solution
• Athena automatically provisions two core sentinel roles:
  1. \`Athena Unbypassable\` - The primary administrative sentinel role.
  2. \`Athena Firewall\` - The gateway and packet-filtering sentinel role.
• **Hierarchy Positioning:** Athena positions these roles at the highest feasible position under the bot's own role.
• **Database ID Tracking:** Sentinel role IDs are immediately stored into SQLite database configuration (\`db.updateGuildConfig\`).
• **Self-Healing Daemon:**
  • If a rogue admin or unauthorized bot attempts to delete a sentinel role (\`roleDelete\`), Athena instantly intercepts the event, re-creates the role via direct REST API, and restores its position and permissions.
  • If permissions are stripped from a sentinel role (\`roleUpdate\`), Athena reinstates the required bitfields within milliseconds.`
      }
    ]
  },

  onboarding: {
    id: 'onboarding',
    label: 'Onboarding Exploit Guard',
    aliases: ['neutralizeonboarding', 'onboardingguard'],
    title: 'Discord Onboarding Vulnerability & Neutralization Engine | <a:atheNATICK:1557841381630681106>',
    description: 'Deep audit of Discord Community Onboarding prompt roles and automatic permission disarming.',
    pages: [
      {
        pageTitle: 'Onboarding Exploit Mechanics & Neutralization',
        content:
`# Discord Onboarding Exploit Vector
• Discord Community Onboarding allows servers to configure questionnaire prompts (e.g. "What is your role?").
• Options can be linked to roles that are automatically assigned when a new user selects an option.
• **The Vulnerability:** A rogue administrator or compromised account can silently attach an **Administrator** role to an Onboarding prompt option.
• When a user joins and selects that option during onboarding, Discord's backend assigns the Administrator role **without generating an Audit Log executor event**.

# Athena Neutralization Engine (\`!neutralizeonboarding\`)
• **REST Audit:** Fetches \`/guilds/{guildId}/onboarding\` via raw Discord REST API.
• **Prompt Scanning:** Iterates through every prompt and option, cross-referencing assigned role IDs.
• **Dangerous Permissions Filter:** Checks if any option's role has:
  • \`Administrator\` (0x8)
  • \`Manage Guild\` (0x20)
  • \`Manage Roles\` (0x10000000)
  • \`Ban Members\` (0x4)
  • \`Kick Members\` (0x2)
  • \`Manage Channels\` (0x10)
  • \`Manage Webhooks\` (0x20000000)
• **Proactive Neutralization:**
  1. Updates the Onboarding prompt to remove the dangerous role reference.
  2. Disarms the role itself by wiping all dangerous permissions to \`0n\`.
  3. Quarantines any unauthorized accounts found holding the role.`
      }
    ]
  },

  automod: {
    id: 'automod',
    label: 'Automod & Filter Engine',
    aliases: ['filters', 'antilink', 'wordfilter', 'wf', 'linksallow', 'links'],
    title: 'Automated Moderation & Filter Engine Architecture | <a:atheNATICK:1557841381630681106>',
    description: 'Real-time regex, punycode de-masking, invite blocking, and domain whitelist architecture.',
    pages: [
      {
        pageTitle: 'Multi-Tier Message Filtering Pipeline',
        content:
`# Automod Real-Time Inspection Pipeline
Athena's automod engine inspects every message across Discord Gateway at raw velocity:

# Tier 1: Real-Time Invite Interception (\`!antiinvite\`)
• Analyzes content using strict regular expressions detecting:
  • \`discord.gg/<code|vanity>\`
  • \`discord.com/invite/<code|vanity>\`
  • Obfuscated invite patterns and zero-width spaces.
• Instantly deletes the message (<5ms) and warns/mutes the offender.

# Tier 2: Link & Phishing Guard (\`!antilink\` & \`!linksallow\`)
• Extracts all HTTP/HTTPS links and bare domain structures.
• De-obfuscates URL punycode, markdown links \`[text](url)\`, and embedded redirectors.
• Verifies domains against the guild's approved domain whitelist (\`linksallow\`).
• If unapproved links are detected, Athena deletes the message and logs forensic details.

# Tier 3: Word Filter & Blacklist (\`!wf\` / \`!blacklist\`)
• Normalizes leetspeak, stripped punctuation, and repeated characters.
• Scans against server blacklist words configured in the database.
• Granular Role Bypass: Server owners can whitelist specific roles (\`!automod bypass add @role\`) to allow staff to share links without triggering automod.`
      }
    ]
  },

  moderation: {
    id: 'moderation',
    label: 'Moderation & Mass Actions',
    aliases: ['mod', 'massactions', 'antiban', 'antiraid', 'modmode'],
    title: 'Zero-Trust Moderation & Mass Action Defense | <a:atheNATICK:1557841381630681106>',
    description: 'Throttled mass actions, anti-ban nuke protection, and reversible maintenance modmode.',
    pages: [
      {
        pageTitle: 'Mass Action Throttling & Rogue Admin Defense',
        content:
`# Mass Action Throttling Engine
Athena actively monitors the velocity of destructive administrative actions:
• **Mass Ban / Kick Protection:** If an authorized admin account is compromised and begins rapid-fire banning members, Athena tracks execution velocity in an in-memory sliding window.
• **Threshold Interception:** When actions exceed configured thresholds (e.g. >3 bans within 10 seconds):
  1. The actor's administrative roles are immediately revoked via direct REST API.
  2. The account is placed into complete Quarantine containment.
  3. Server-wide Emergency Panic Lockdown (\`!panic\`) is automatically triggered to freeze the server.

# Reversible Maintenance Modmode (\`!modmode\`)
• During legitimate server revamps or migrations, owners need to perform bulk edits.
• Running \`!modmode on\` temporarily suppresses restoration and anti-nuke triggers for the Server Owner while maintaining audit trail logging.
• Once maintenance is finished, \`!modmode off\` re-arms all zero-day defense interceptors immediately.`
      }
    ]
  },

  quarantine: {
    id: 'quarantine',
    label: 'Quarantine Containment',
    aliases: ['isolation', 'quarantinesystem'],
    title: 'Zero-Trust Quarantine Isolation Architecture | <a:atheNATICK:1557841381630681106>',
    description: 'Full guild channel permission overrides, role strip caching, and forensic isolation.',
    pages: [
      {
        pageTitle: 'Quarantine Setup & Containment Lifecycle',
        content:
`# Zero-Trust Quarantine Containment
Athena's quarantine system provides full cryptographic isolation of compromised accounts:

# 1. Infrastructure Provisioning (\`!quarantine setup\`)
• Automatically establishes:
  • \`Quarantine Category\` (locked from view)
  • \`Quarantined Role\` (isolated permission bitfields)
  • \`Quarantine Text Channel\` (restricted staff communication)
  • \`Quarantine Voice Channel\`
• **Database ID Binding:** Channel and role IDs are permanently bound in SQLite database.

# 2. Synchronized Guild Isolation
• When a user is quarantined:
  1. Athena iterates through 100% of guild channels, setting permission overwrites for the Quarantined role to explicitly DENY \`ViewChannel\`, \`SendMessages\`, and \`Connect\`.
  2. The offender's active roles are backed up to the database, then stripped via API.
  3. The member is granted the Quarantined role and redirected to the quarantine text channel.

# 3. Clean Release & Role Restoration
• When released via \`!quarantine release <user>\`, Athena retrieves the preserved role IDs from SQLite and restores the member's original roles cleanly.`
      }
    ]
  },

  cloudsync: {
    id: 'cloudsync',
    label: 'Cloud Backup & Manifest',
    aliases: ['backup', 'cloud', 'backupsystem'],
    title: 'Cloud Backup & Persistence Manifest Architecture | <a:atheNATICK:1557841381630681106>',
    description: 'Full guild snapshot serialization, cloud storage dispatch, and 1-click disaster recovery.',
    pages: [
      {
        pageTitle: 'Snapshot Serialization & Disaster Recovery',
        content:
`# Cloud Backup & Persistence Architecture
Athena Prime guarantees server survival even against total guild wipeouts:

# 1. State Snapshot Serialization
• Every cloud backup captures:
  • **Channels:** Position, parent category, type, topic, bitrate, slowmode.
  • **Permission Overwrites:** Complete \`allow\` and \`deny\` bitfields for every role and member.
  • **Roles:** Name, color, hoist status, position hierarchy, icon, permissions bitfield.
  • **Emojis & Stickers:** Assets downloaded and bundled into encrypted storage.
  • **Server Config:** Vanity URL, afk channel, system channel, verification level.

# 2. Cloud Channel Storage
• Snapshots are serialized into encrypted JSON and dispatched to the designated private Cloud Storage channel.
• Backups feature interactive Components V2 verification cards and persistence manifest logs.

# 3. Sub-Second Disaster Recovery
• Running \`!backup load <id>\` restores 100% of server channels, permissions, and roles in exact hierarchical sequence.`
      }
    ]
  },

  auth: {
    id: 'auth',
    label: 'Access Control & Tiers',
    aliases: ['tiers', 'clearance', 'perms', 'tier'],
    title: 'Three-Tier Access Control & Role Authorization | <a:atheNATICK:1557841381630681106>',
    description: 'Three-tier hierarchy (Admin, Mod, Staff), database ID binding, and privilege escalation guards.',
    pages: [
      {
        pageTitle: 'Three-Tier Authorization Matrix',
        content:
`# Three-Tier Access Control System
Athena Prime separates security administration into distinct, tamper-proof tiers:

# Tier 1: Admin Tier (\`!auth admin @role\`)
• Granted access to server configuration, autoroles, verification setup, and sentinel deployment.
• Protected by the Real-Time Role Interceptor against unauthorized self-assignment.

# Tier 2: Mod Tier (\`!auth mod @role\`)
• Granted moderation execution permissions: mute, timeout, kick, warn, purge, and lock.
• Throttled by the Mass Action engine to prevent compromised mod accounts from mass-kicking members.

# Tier 3: Staff Tier (\`!auth staff @role\`)
• Granted community assistance permissions: ticket management, chat moderation, and slowmode controls.

# Database ID Enforcement
• All authorized roles are stored and verified by ID in SQLite database (\`auth_tiers\` table).
• Role name spoofing or role renaming is completely ineffective against Athena's ID-based validation.`
      }
    ]
  }
};

/**
 * Detailed command mechanics, parameters, permissions, and internal architecture.
 */
export const DETAILED_COMMANDS = {
  unbypassable: {
    name: 'unbypassable',
    aliases: ['unb', 'persistenceroles', 'sentinels'],
    category: 'Security & Access Control',
    clearance: 'Administrators, Server Owner, Extra Owners, Bot Owners',
    syntax: '!unbypassable [deploy|check|status|repair]',
    purpose: 'Establishes and maintains unbypassable administrative persistence sentinel roles at the pinnacle of the role hierarchy.',
    architecture: 
`• **Gateway & REST Interaction:** Queries guild role hierarchy, verifies position of bot's integration role, and provisions \`Athena Unbypassable\` and \`Athena Firewall\`.
• **Database ID Binding:** Role IDs are saved directly to database configuration to prevent duplicate role creation.
• **Self-Healing Hook:** Binds to \`antiStrip.js\` and \`guildRoleDelete\` to automatically detect tampering and reinstate sentinel roles within <10ms.
• **Exploit Protection:** Prevents rogue admins from stripping top-level security roles or demoting bot authority.`,
    example: '!unbypassable deploy'
  },

  neutralizeonboarding: {
    name: 'neutralizeonboarding',
    aliases: ['onboarding', 'neutralize'],
    category: 'Security & Access Control',
    clearance: 'Extra Owner / Server Owner',
    syntax: '!neutralizeonboarding [audit|clean]',
    purpose: 'Scans Discord Community Onboarding questionnaire prompts for dangerous permissions and neutralizes unlogged role exploits.',
    architecture: 
`• **REST Inspection:** Connects to \`/guilds/{id}/onboarding\` endpoint and inspects all prompt options.
• **Permission Bitfield Scan:** Flags any option attached to roles with \`Administrator\`, \`Manage Server\`, \`Manage Roles\`, etc.
• **Proactive Scrubbing:** Removes the role reference from the onboarding prompt, sets role permissions to 0n, and quarantines unauthorized holders.
• **Exploit Protection:** Closes the zero-audit-log Linked Role & Onboarding privilege escalation loophole.`,
    example: '!neutralizeonboarding'
  },

  antinuke: {
    name: 'antinuke',
    aliases: ['an'],
    category: 'Security & Access Control',
    clearance: 'Extra Owner / Server Owner',
    syntax: '!antinuke [config|status|guide]',
    purpose: 'Interactive dashboard for Athena Prime zero-day autonomous antinuke defense system.',
    architecture: 
`• **Strike Engine:** Direct REST API execution strikes nukers in ~1-3 milliseconds upon threshold breach.
• **Websocket Wiretap:** Intercepts role, channel, webhook, and member events with zero gateway latency.
• **Condemned Cache:** Known malicious actors are immediately isolated without redundant audit evaluations.
• **Channel & Role Healing:** Automatically reconstructs deleted channels and roles with original permissions intact.`,
    example: '!antinuke config'
  },

  firewall: {
    name: 'firewall',
    aliases: ['fw'],
    category: 'Security & Access Control',
    clearance: 'Public / Everyone',
    syntax: '!firewall',
    purpose: 'Displays live gateway telemetry, strike engine uptime, and active antinuke defense shield status.',
    architecture: 
`• **Telemetry Inspection:** Computes gateway heartbeat latency, websocket ping, active module bitmasks, and cached audit thresholds.
• **Read-Only Container:** Formatted via Components V2 with live uptime indicator ticks.`,
    example: '!firewall'
  },

  panic: {
    name: 'panic',
    aliases: ['emergency', 'lockdown'],
    category: 'Security & Access Control',
    clearance: 'Extra Owner / Server Owner',
    syntax: '!panic / !emergency',
    purpose: 'Immediately freezes the entire server, revokes public send permissions, and initiates full defensive lockdown.',
    architecture: 
`• **Channel Mass Overwrite:** Simultaneously updates \`@everyone\` permission overwrites across all channels to deny \`SendMessages\`, \`AddReactions\`, and \`Connect\`.
• **Invite Invalidation:** Pauses or disables guild invites to halt active raids in progress.
• **Lift Command:** \`!endemergency\` cleanly restores previous channel permissions from database cache.`,
    example: '!panic'
  },

  automod: {
    name: 'automod',
    aliases: ['filters', 'automoderator'],
    category: 'Security & Access Control',
    clearance: 'Extra Owner / Server Owner',
    syntax: '!automod [config|bypass|advanced]',
    purpose: 'Interactive configuration console for real-time link, invite, phishing, and word filter defenses.',
    architecture: 
`• **Multi-Tier Processing:** Synchronous message inspection across regular expression, unicode normalization, and domain whitelists.
• **Granular Role Bypass:** Allows specific trusted roles to bypass individual filter modules while enforcing rules on general members.`,
    example: '!automod config'
  },

  scanserver: {
    name: 'scanserver',
    aliases: ['auditperms', 'secscan'],
    category: 'Security & Access Control',
    clearance: 'Extra Owner / Server Owner',
    syntax: '!scanserver',
    purpose: 'Audits every role and integrated bot in the server for dangerous permissions, rogue integrations, and privilege escalation risks.',
    architecture: 
`• **Permission Matrix Audit:** Inspects all guild roles for \`Administrator\` (0x8) and administrative flags.
• **Bot Integration Audit:** Flags external bots holding dangerous permissions that are not registered in Athena's trusted whitelist (\`!botwhitelist\`).
• **Actionable Report:** Outputs a structured Components V2 container detailing vulnerable roles and recommendations.`,
    example: '!scanserver'
  },

  quarantine: {
    name: 'quarantine',
    aliases: ['isolate'],
    category: 'Security & Access Control',
    clearance: 'Administrator / Extra Owner',
    syntax: '!quarantine <@user|id> [reason] / !quarantine setup / !quarantine release <@user|id>',
    purpose: 'Isolates suspect accounts into a dedicated, locked quarantine containment environment while backing up original roles.',
    architecture: 
`• **Permission Enclosure:** Overrides channel permissions across all guild channels to completely isolate the user.
• **Role Preservation:** Backs up user roles into SQLite database and strips them via API.
• **Restoration:** On \`!quarantine release\`, retrieves saved role IDs and restores them cleanly.`,
    example: '!quarantine @user Suspicious behavior'
  },

  backup: {
    name: 'backup',
    aliases: ['cloudsync', 'snapshot'],
    category: 'Server Administration',
    clearance: 'Server Owner / Extra Owner',
    syntax: '!backup create / !backup load <id> / !backup list',
    purpose: 'Creates encrypted cloud snapshots of server structure, roles, permissions, channels, and configuration.',
    architecture: 
`• **Deep Serialization:** Captures every channel attribute, role hierarchy position, and permission overwrite.
• **Cloud Dispatch:** Posts encrypted JSON payload to private cloud storage channel.
• **Instant Restore:** Rebuilds channels and roles with exact previous settings.`,
    example: '!backup create'
  }
};

/**
 * Build a structured Components V2 container for an Architecture Topic or Command deep dive.
 */
export function buildExplainContainer(topicOrCmd, pageIndex = 0, prefix = '!') {
  const q = String(topicOrCmd || '').toLowerCase().trim();

  // 1. Check if it matches an Architecture Topic
  let matchedTopic = null;
  for (const key of Object.keys(ARCHITECTURE_TOPICS)) {
    const t = ARCHITECTURE_TOPICS[key];
    if (t.id === q || t.aliases.includes(q)) {
      matchedTopic = t;
      break;
    }
  }

  if (matchedTopic) {
    const totalPages = matchedTopic.pages.length;
    const safeIndex = Math.max(0, Math.min(pageIndex, totalPages - 1));
    const currentPage = matchedTopic.pages[safeIndex];

    const rawComponents = [];

    // Header
    rawComponents.push({
      type: 10,
      content: `# ${matchedTopic.title}\n> -# **Topic Overview:** ${matchedTopic.description}\n> -# **Section [${safeIndex + 1}/${totalPages}]:** **${currentPage.pageTitle}**`
    });
    rawComponents.push({ type: 14, divider: true });

    // Page Content
    rawComponents.push({
      type: 10,
      content: currentPage.content
    });
    rawComponents.push({ type: 14, divider: true });

    // Navigation Buttons (Row 1)
    const navButtons = [];
    if (safeIndex > 0) {
      navButtons.push({
        type: 2,
        custom_id: `arch_page_${matchedTopic.id}_${safeIndex - 1}`,
        label: 'Previous Section',
        style: 2,
        emoji: { id: '1523766004839088301' }
      });
    }
    if (safeIndex < totalPages - 1) {
      navButtons.push({
        type: 2,
        custom_id: `arch_page_${matchedTopic.id}_${safeIndex + 1}`,
        label: 'Next Section',
        style: 2,
        emoji: { id: '1523766065576935475' }
      });
    }
    navButtons.push({
      type: 2,
      custom_id: 'arch_home',
      label: 'Topic Directory',
      style: 2,
      emoji: { id: '1523765738655973589' }
    });
    navButtons.push({
      type: 2,
      custom_id: 'arch_close',
      label: 'Close',
      style: 2,
      emoji: { id: '1523766340752642109' }
    });

    rawComponents.push({
      type: 1,
      components: navButtons
    });

    rawComponents.push({ type: 14, divider: true });
    rawComponents.push({
      type: 10,
      content: '-# **Athena Prime Deep-Dive Architecture Matrix · Unbypassable Security**'
    });

    return {
      type: 17,
      components: rawComponents
    };
  }

  // 2. Check if it matches a Detailed Command
  let matchedCmd = null;
  for (const key of Object.keys(DETAILED_COMMANDS)) {
    const c = DETAILED_COMMANDS[key];
    if (c.name === q || c.aliases.includes(q)) {
      matchedCmd = c;
      break;
    }
  }

  if (matchedCmd) {
    const aliasesText = matchedCmd.aliases.map(a => `\`${prefix}${a}\``).join(', ') || '`None`';
    const rawComponents = [
      {
        type: 10,
        content: 
`# Command Architecture: \`${prefix}${matchedCmd.name}\` | <a:atheNATICK:1557841381630681106>
> -# **Category:** ${matchedCmd.category}
> -# **Required Clearance:** \`${matchedCmd.clearance}\`
> -# **Aliases:** ${aliasesText}
> -# **Syntax:** \`${matchedCmd.syntax.replace(/!/g, prefix)}\``
      },
      { type: 14, divider: true },
      {
        type: 10,
        content:
`### Purpose & Functional Objective
> **${matchedCmd.purpose}**

### Internal Architecture & Gateway Mechanics
${matchedCmd.architecture}

### Verified Example
> \`${matchedCmd.example.replace(/!/g, prefix)}\``
      },
      { type: 14, divider: true },
      {
        type: 1,
        components: [
          { type: 2, custom_id: 'arch_home', label: 'Topic Directory', style: 2, emoji: { id: '1523765738655973589' } },
          { type: 2, custom_id: 'arch_close', label: 'Close', style: 2, emoji: { id: '1523766340752642109' } }
        ]
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: '-# **Athena Prime Deep-Dive Architecture Matrix · Unbypassable Security**'
      }
    ];

    return {
      type: 17,
      components: rawComponents
    };
  }

  // 3. Fallback: Build the Architecture Topics Directory
  return buildTopicsDirectoryContainer(prefix);
}

/**
 * Builds the Directory of all available Architecture Explanations.
 */
export function buildTopicsDirectoryContainer(prefix = '!') {
  const selectOptions = [
    {
      label: 'Security & Role Exploits',
      description: 'Linked Roles, 60s solution, and zero-day interceptor',
      value: 'security'
    },
    {
      label: 'Persistence Sentinel Roles',
      description: 'Athena Unbypassable, hierarchy & self-healing',
      value: 'unbypassable'
    },
    {
      label: 'Onboarding Exploit Guard',
      description: 'Neutralizing dangerous onboarding prompt roles',
      value: 'onboarding'
    },
    {
      label: 'Automod & Filter Engine',
      description: 'Real-time regex, link whitelists, and word filters',
      value: 'automod'
    },
    {
      label: 'Moderation & Mass Actions',
      description: 'Anti-raid throttling, rogue admin detection, modmode',
      value: 'moderation'
    },
    {
      label: 'Quarantine Containment',
      description: 'Zero-trust isolation, role strip caching, permissions',
      value: 'quarantine'
    },
    {
      label: 'Cloud Backup & Manifest',
      description: 'Encrypted snapshot serialization and 1-click restore',
      value: 'cloudsync'
    },
    {
      label: 'Access Control & Tiers',
      description: 'Admin, Mod, and Staff role authorization tiers',
      value: 'auth'
    }
  ];

  const rawComponents = [
    {
      type: 10,
      content: 
`# Architecture & Command Deep-Dive Explainer | <a:atheNATICK:1557841381630681106>
> <a:uptime:1552608831060844575> **Welcome to the Athena Prime Architecture Explainer Engine!**
> This system provides full under-the-hood technical breakdowns, exploit vector analyses, and gateway mechanics for all core security and management systems.

### Available Architecture Topics:
• **Security & Linked Role Exploits**: Deep dive on unlogged Linked Role bypasses & the 60s audit threshold.
• **Persistence Sentinel Roles**: How \`!unbypassable\` maintains unstripable administrative hierarchy.
• **Onboarding Exploit Guard**: How \`!neutralizeonboarding\` audits and neutralizes prompt roles.
• **Automod & Link Filters**: Multi-tier regex, punycode de-masking, and role bypasses.
• **Moderation & Mass Actions**: Rogue admin velocity throttling & emergency panic freezing.
• **Quarantine Isolation**: Sub-millisecond channel permission containment & role caching.
• **Cloud Backup & Sync**: Encrypted server state snapshots & instant disaster recovery.
• **Access Control Tiers**: Three-tier database-enforced role authorization matrix.

> -# **To inspect any specific command:** Type \`${prefix}explain <command>\` (e.g. \`${prefix}explain unbypassable\`, \`${prefix}explain antinuke\`, \`${prefix}explain kick\`)`
    },
    { type: 14, divider: true },
    {
      type: 1,
      components: [
        {
          type: 3,
          custom_id: 'arch_select_topic',
          placeholder: 'Select an Architecture Deep-Dive Topic...',
          options: selectOptions
        }
      ]
    },
    { type: 14, divider: true },
    {
      type: 1,
      components: [
        { type: 2, custom_id: 'arch_topic_security', label: 'Security & Exploits', style: 2 },
        { type: 2, custom_id: 'arch_topic_unbypassable', label: 'Sentinel Roles', style: 2 },
        { type: 2, custom_id: 'arch_topic_onboarding', label: 'Onboarding Guard', style: 2 },
        { type: 2, custom_id: 'arch_topic_automod', label: 'Automod Engine', style: 2 },
        { type: 2, custom_id: 'arch_close', label: 'Close', style: 2, emoji: { id: '1523766340752642109' } }
      ]
    },
    { type: 14, divider: true },
    {
      type: 10,
      content: '-# **Athena Prime Deep-Dive Architecture Matrix · Unbypassable Security**'
    }
  ];

  return {
    type: 17,
    components: rawComponents
  };
}
