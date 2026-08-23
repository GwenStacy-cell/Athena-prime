import fs from 'fs';
let code = fs.readFileSync('src/commands/utility.js', 'utf8');

const backupMod = `{ id: 'backup', shortLabel: 'Backup', label: 'Server Backup', emoji: '<:emoji_16:1521464002046328944>', commands: ['\`!ezal\` - Backup all current server settings, roles, and channels \`[extra owners]\`', '\`!fck\` - Delete backup data \`[extra owners]\`', '\`!enuke\` - Completely wipe the server (unrecoverable) \`[server owner]\`'] },`;

const ticketsMod = `{ id: 'tickets', shortLabel: 'Tickets', label: 'Support Tickets', emoji: '<:emoji_16:1521464002046328944>', commands: ['\`!ticketpanel\` - Open the interactive Ticket Panel builder \`[extra owners]\`', '\`!ticket\` **add/remove** \`@user\` - Manage ticket access \`[support team]\`', '\`!ticket\` **close/reopen/delete** - Manage ticket lifecycle \`[support team]\`'] },`;

const logsMod = `{ id: 'logs', shortLabel: 'Logs', label: 'Server Logging', emoji: '<:emoji_16:1521464002046328944>', commands: ['\`!serverlogs\` - Open the interactive Server Logging dashboard \`[extra owners]\`', '\`!setdeletelog\` \`#channel\` - Set a dedicated channel for message delete logs \`[extra owners]\`'] },`;

code = code.replace(
  "{ id: 'utilities', shortLabel: 'Utility'",
  `${backupMod}\n    ${ticketsMod}\n    ${logsMod}\n    { id: 'utilities', shortLabel: 'Utility'`
);

const custModSearch = "`!stealemoji` - Cross-server Emoji Stealer `[bot/server owner]`'] }";
const custModReplace = "`!stealemoji` - Cross-server Emoji Stealer `[bot/server owner]`', '\`!np\` **add/remove/list** \`@user\` - Manage global No-Prefix access \`[bot owner]\`'] }";
code = code.replace(custModSearch, custModReplace);

fs.writeFileSync('src/commands/utility.js', code);
