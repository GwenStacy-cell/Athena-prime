import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const start = js.indexOf("const helpModules = [");
const end = js.indexOf("];\n", start) + 3;

const newModules = `const helpModules = [
  { id: 'security', category: 'SECURITY & ACCESS CONTROL', shortLabel: 'Security', label: 'Security & Firewall', emoji: 'security', commands: ['**Anti-Nuke Systems**', '\`!security enable all\` - Activate the God-Tier Firewall.', '\`!security disable all\` - Disable all security shields.', '\`!ss\` or \`!security status\` - View the live Security Firewall Status panel.', '\`!antinuke config\` - Interactive panel to toggle specific modules.'] },
  { id: 'filters', category: 'SECURITY & ACCESS CONTROL', shortLabel: 'Filters', label: 'Automod Filters', emoji: 'filters', commands: ['**Auto-Moderation**', '\`!automod config\` - Open the interactive Automod configuration dashboard.', '\`!automod advanced\` - Global link & invite toggles.', '\`!automod bypass add @role\` - Grant granular bypasses for specific modules.', '\`!automod bypass list\` - View all bypassed roles.', '\`!wordfilter\` - Manage the banned word list.'] },
  { id: 'quarantine', category: 'SECURITY & ACCESS CONTROL', shortLabel: 'Quarantine', label: 'Quarantine System', emoji: 'quarantine', commands: ['**Threat Containment**', '\`!qrmanager setup\` - Configure Quarantine role, VC, and channel.', '\`!quarantine @user [reason]\` - Isolate a user instantly.', '\`!unquarantine @user\` - Lift quarantine status.'] },
  { id: 'whitelist', category: 'SECURITY & ACCESS CONTROL', shortLabel: 'Whitelist', label: 'Whitelist & Access', emoji: 'whitelist', commands: ['**Access Control**', '\`!whitelist @user\` - Grant immunity from Anti-Nuke.', '\`!whitelist @role\` - Whitelist a role from being punished.', '\`!botwhitelist add <id>\` - Allow specific bots to join the server.', '\`!extraowner add @user\` - Grant co-owner privileges.'] },
  { id: 'verification', category: 'SECURITY & ACCESS CONTROL', shortLabel: 'Verify', label: 'Verification Gate', emoji: 'verification', commands: ['**Server Verification**', '\`!verify setup\` - Initialize the Captcha Verification system.', '\`!verify config\` - Change verification difficulty and role.'] },
  
  { id: 'moderation', category: 'SERVER ADMINISTRATION', shortLabel: 'Moderation', label: 'Moderation Tools', emoji: 'moderation', commands: ['**Server Moderation**', '\`!ban / !kick / !mute / !warn\` - Standard moderation tools.', '\`!purge <amount>\` - Clear messages in bulk.', '\`!lock / !unlock\` - Lockdown a channel.', '\`!nuke\` - Recreate a channel from scratch.'] },
  { id: 'tracking', category: 'SERVER ADMINISTRATION', shortLabel: 'Tracking', label: 'Engagement & Tracking', emoji: 'tracking', commands: ['**Logs & Tracking**', '\`!serverlogs autosetup\` - Setup the Advanced Logging system.', '\`!invitesetup #channel\` - Advanced Invite Tracker.', '\`!record start\` - Live VC audio recording.'] },
  { id: 'config', category: 'SERVER ADMINISTRATION', shortLabel: 'Config', label: 'Customization & Roles', emoji: 'config', commands: ['**Server Config**', '\`!prefix <new>\` - Change bot prefix.', '\`!accent\` - Modify embed colors.', '\`!autonick on\` - Standardize member nicknames.'] },
  { id: 'welcome', category: 'SERVER ADMINISTRATION', shortLabel: 'Welcome', label: 'Welcome System', emoji: 'welcome', commands: ['**Welcome & Leave**', '\`!welcome setup\` - Build interactive welcome messages.', '\`!autorole add @role\` - Automatically assign roles on join.'] },
  { id: 'noprefix', category: 'SERVER ADMINISTRATION', shortLabel: 'No-Prefix', label: 'No-Prefix Management', emoji: 'noprefix', commands: ['**Global Access**', '\`!noprefix add @user\` - Allow user to execute commands without a prefix.', '\`!noprefix list\` - View all no-prefix users.'] },
  
  { id: 'leveling', category: 'COMMUNITY & ENGAGEMENT', shortLabel: 'Leveling', label: 'Leveling Engine', emoji: 'leveling', commands: ['**XP System**', '\`!xpsetup\` - Launch the interactive XP control panel.', '\`!rank [@user]\` - View level and progress graphic.', '\`!leaderboard\` - View top active members.'] },
  { id: 'stats', category: 'COMMUNITY & ENGAGEMENT', shortLabel: 'Stats', label: 'Statistics', emoji: 'stats', commands: ['**Server Stats**', '\`!me\` - View your personal message stats.', '\`!top\` - Combined server leaderboard.', '\`!server\` - Graphical server statistics overview.'] },
  { id: 'giveaways', category: 'COMMUNITY & ENGAGEMENT', shortLabel: 'Giveaways', label: 'Birthdays & Giveaways', emoji: 'giveaways', commands: ['**Giveaways**', '\`!giveaway start\` - Launch an interactive giveaway.', '\`!birthday set @user\` - Register a birthday.'] },
  { id: 'triggers', category: 'COMMUNITY & ENGAGEMENT', shortLabel: 'Triggers', label: 'Auto-Responder', emoji: 'triggers', commands: ['**Custom Triggers**', '\`!trigger create <match> | <resp>\` - Create an auto-response.', '\`!trigger list\` - View active triggers.'] },
  { id: 'autoreact', category: 'COMMUNITY & ENGAGEMENT', shortLabel: 'Auto-React', label: 'Auto-Reactions', emoji: 'autoreact', commands: ['**Reactions**', '\`!autoreact add <word> <emoji>\` - Automatically react to keywords.', '\`!autoreact list\` - View active reactions.'] },
  { id: 'actions', category: 'COMMUNITY & ENGAGEMENT', shortLabel: 'Roleplay', label: 'Roleplay Actions', emoji: 'actions', commands: ['**Social Actions**', '\`!hug / !kiss / !slap / !pat\` - Interact with other users.', '\`!date @user\` - Go on a romantic date.'] },
  
  { id: 'voice', category: 'VOICE & MEDIA', shortLabel: 'Voice', label: 'Voice Management', emoji: 'voice', commands: ['**VC Tools**', '\`!vcsetup\` - Setup Join-to-Create (JTC) voice channels.', '\`!vclist\` - View all active JTC channels.'] },
  { id: 'music', category: 'VOICE & MEDIA', shortLabel: 'Music', label: 'Music Player', emoji: 'music', commands: ['**Audio Playback**', '\`!play <song>\` - Play music in your voice channel.', '\`!skip / !stop / !queue\` - Manage the music queue.'] },
  { id: 'tts', category: 'VOICE & MEDIA', shortLabel: 'TTS', label: 'Text-to-Speech', emoji: 'tts', commands: ['**TTS Engine**', '\`!tts <message>\` - Speak text in the voice channel.', '\`!tts config\` - Change TTS voice and speed.'] },
  { id: 'messaging', category: 'VOICE & MEDIA', shortLabel: 'Messaging', label: 'Announcements', emoji: 'messaging', commands: ['**Global Messaging**', '\`!announce #channel <msg>\` - Send official announcements.', '\`!sticky add <msg>\` - Create sticky messages.'] },
  
  { id: 'utilities', category: 'UTILITIES & INTEGRATIONS', shortLabel: 'Utility', label: 'General Utilities', emoji: 'utility', commands: ['**Tools**', '\`!afk [reason]\` - Set AFK status.', '\`!ping / !time\` - Check bot latency.', '\`!calculator\` - Interactive math calculator.'] },
  { id: 'customcmds', category: 'UTILITIES & INTEGRATIONS', shortLabel: 'Custom Cmds', label: 'Custom Commands', emoji: 'customcmds', commands: ['**Server Commands**', '\`!ccmd add <name> <response>\` - Create a custom server command.', '\`!ccmd list\` - View all custom commands.'] },
  { id: 'tickets', category: 'UTILITIES & INTEGRATIONS', shortLabel: 'Tickets', label: 'Support Tickets', emoji: 'tickets', commands: ['**Ticket System**', '\`!ticket\` - Launch the Ticket Panel Builder.', '\`!close\` - Close an active ticket thread.'] },
  { id: 'newsfeed', category: 'UTILITIES & INTEGRATIONS', shortLabel: 'News', label: 'News Feed', emoji: 'newsfeed', commands: ['**RSS & News**', '\`!news setup #channel\` - Setup automated news feeds.', '\`!news add <source>\` - Subscribe to BBC, CNN, etc.'] }
];
`;

js = js.substring(0, start) + newModules + js.substring(end);
fs.writeFileSync("src/commands/utility.js", js);
console.log("Updated helpModules!");
