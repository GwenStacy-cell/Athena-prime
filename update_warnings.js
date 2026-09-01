import fs from "fs";
let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

// Fix the anti-invite warning
text = text.replace(
    /type: 9,\s*components: \[\{\s*type: 10,\s*content: `\*\*Warned Sending Invites \|\*\* <:[a-zA-Z0-9]+:[0-9]+>\\n> Reason: \. \$\{message\.author\} , \*\*Posted Discord Invite\*\*\\n> .*? has been warned " Your Limit is \$\{warns\.length\}\/\$\{maxWarnings\} " Exceeding the limits will leads to punishments ,`\s*\}\],/s,
    `type: 9,
                    components: [
                      { type: 10, content: \`-# **Warned Sending Invites |** <:cross_red:1533860128015519895>\` },
                      { type: 10, content: \`-# Reason: . \${message.author} , **Posted Discord Invite**\` },
                      { type: 10, content: \`-# ↳ has been warned " Your Limit is \${warns.length}/\${maxWarnings} " Exceeding the limits will leads to punishments ,\` }
                    ],`
);

// Fix the word filter warning
text = text.replace(
    /type: 9,\s*components: \[\{\s*type: 10,\s*content: `\*\*Word Filter Triggered \|\*\* <:[a-zA-Z0-9]+:[0-9]+>\\n> Reason: \. \$\{message\.author\} , \*\*Posted Blacklisted Word\*\*\\n> .*? has been warned " Your Limit is \$\{warns\.length\}\/\$\{maxWarnings\} " Exceeding the limits will leads to punishments ,`\s*\}\],/s,
    `type: 9,
                    components: [
                      { type: 10, content: \`-# **Word Filter Triggered |** <:cross_red:1533860128015519895>\` },
                      { type: 10, content: \`-# Reason: . \${message.author} , **Posted Blacklisted Word**\` },
                      { type: 10, content: \`-# ↳ has been warned " Your Limit is \${warns.length}/\${maxWarnings} " Exceeding the limits will leads to punishments ,\` }
                    ],`
);

fs.writeFileSync("src/events/messageCreate.js", text);
