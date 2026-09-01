import fs from "fs";
let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

const fixedInvite = `type: 9,
                    components: [
                      { type: 10, content: \`-# **Warned Sending Invites |** <:cross_red:1533860128015519895>\` },
                      { type: 10, content: \`-# Reason: . \${message.author} , **Posted Discord Invite**\` },
                      { type: 10, content: \`-# \\u21B3 has been warned " Your Limit is \${warns.length}/\${maxWarnings} " Exceeding the limits will leads to punishments ,\` }
                    ],`;

const fixedWord = `type: 9,
                    components: [
                      { type: 10, content: \`-# **Word Filter Triggered |** <:cross_red:1533860128015519895>\` },
                      { type: 10, content: \`-# Reason: . \${message.author} , **Posted Blacklisted Word**\` },
                      { type: 10, content: \`-# \\u21B3 has been warned " Your Limit is \${warns.length}/\${maxWarnings} " Exceeding the limits will leads to punishments ,\` }
                    ],`;

text = text.replace(/type: 9,\s*components: \[\s*\{\s*type: 10, content: `-# \*\*Warned Sending Invites[\s\S]*?Exceeding the limits will leads to punishments ,` \}\s*\],/g, fixedInvite);
text = text.replace(/type: 9,\s*components: \[\s*\{\s*type: 10, content: `-# \*\*Word Filter Triggered[\s\S]*?Exceeding the limits will leads to punishments ,` \}\s*\],/g, fixedWord);

fs.writeFileSync("src/events/messageCreate.js", text);
