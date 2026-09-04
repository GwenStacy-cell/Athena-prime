import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

js = js.replace(
  /\{ id: 'whitelist', shortLabel: 'Whitelist', label: 'Whitelist & Permissions'/,
  `{ id: 'np', shortLabel: 'No-Prefix', label: 'No-Prefix (NP) Bypass', emoji: '<:emoji_16:1521464002046328944>', commands: ['\`!np add user\` \`@user|id\` \`[duration]\` - Grant No-Prefix bypass \`[bot owner/np manager]\`', '\`!np add server\` \`id\` \`[duration]\` - Grant No-Prefix to entire server \`[bot owner/np manager]\`', '\`!np reset user\` \`id\` - Revoke user No-Prefix bypass \`[bot owner/np manager]\`', '\`!np reset server\` \`id\` - Revoke server No-Prefix bypass \`[bot owner/np manager]\`', '\`!np guide\` - View full No-Prefix system guide \`[np manager]\`'] },\n    { id: 'whitelist', shortLabel: 'Whitelist', label: 'Whitelist & Permissions'`
);

fs.writeFileSync("src/commands/utility.js", js);
