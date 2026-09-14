import fs from "fs";
let js = fs.readFileSync("src/commands/shortcuts.js", "utf8");

const oldStart = "const text =";
const oldEnd = "- Use \\`!shortcuts enable\\` or \\`!shortcuts disable\\` to toggle these aliases globally for your server.\`;";

const fullOld = js.substring(js.indexOf(oldStart), js.indexOf(oldEnd) + oldEnd.length);

const newText = `const text = \`# Athena Shortcuts Manager\\n\` +
      \`- Global Status: \${enabledText}\\n\\n\` +
      \`**[ SECURITY ]**\\n\` +
      \`> \\\`!sec\\\` or \\\`!shield\\\` ➔ \\\`!security\\\`\\n\` +
      \`> \\\`!an\\\` ➔ \\\`!antinuke\\\`\\n\` +
      \`> \\\`!cfg\\\` ➔ \\\`!config\\\`\\n\` +
      \`> \\\`!qr\\\` or \\\`!q\\\` ➔ \\\`!quarantine\\\`\\n\` +
      \`> \\\`!unq\\\` ➔ \\\`!unquarantine\\\`\\n\` +
      \`> \\\`!mq\\\` ➔ \\\`!massquarantine\\\`\\n\` +
      \`> \\\`!muq\\\` ➔ \\\`!massunquarantine\\\`\\n\` +
      \`> \\\`!ld\\\` or \\\`!lock\\\` ➔ \\\`!lockdown\\\`\\n\` +
      \`> \\\`!em\\\` or \\\`!panic\\\` ➔ \\\`!emergency\\\`\\n\` +
      \`> \\\`!bl\\\` or \\\`!wf\\\` ➔ \\\`!blacklist\\\`\\n\` +
      \`> \\\`!scan\\\` ➔ \\\`!scanserver\\\`\\n\` +
      \`> \\\`!raid\\\` or \\\`!rm\\\` ➔ \\\`!raidmode\\\`\\n\\n\` +
      \`**[ MODERATION ]**\\n\` +
      \`> \\\`!b\\\` ➔ \\\`!ban\\\`\\n\` +
      \`> \\\`!k\\\` ➔ \\\`!kick\\\`\\n\` +
      \`> \\\`!m\\\` ➔ \\\`!mute\\\`\\n\` +
      \`> \\\`!to\\\` ➔ \\\`!timeout\\\`\\n\` +
      \`> \\\`!w\\\` ➔ \\\`!warn\\\`\\n\` +
      \`> \\\`!cw\\\` ➔ \\\`!clearwarns\\\`\\n\` +
      \`> \\\`!c\\\` or \\\`!clear\\\` ➔ \\\`!purge\\\`\\n\\n\` +
      \`**[ UTILITIES ]**\\n\` +
      \`> \\\`!p\\\` ➔ \\\`!ping\\\`\\n\` +
      \`> \\\`!av\\\` or \\\`!pfp\\\` ➔ \\\`!avatar\\\`\\n\` +
      \`> \\\`!brb\\\` ➔ \\\`!afk\\\`\\n\\n\` +
      \`- Use \\\`!shortcuts enable\\\` or \\\`!shortcuts disable\\\` to toggle these aliases globally for your server.\`;`;

js = js.replace(fullOld, newText);
fs.writeFileSync("src/commands/shortcuts.js", js);
console.log("Fixed shortcuts.js emojis");
