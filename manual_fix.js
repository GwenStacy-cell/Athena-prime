import fs from "fs";

let text = fs.readFileSync("src/events/messageDelete.js", "utf8");
let lines = text.split("\n");

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("const name = mem?.displayName")) {
    lines[i] = "      let name = mem?.displayName || u?.globalName || u?.username || 'Unknown';\n      name = name.replace(/[\\[\\]\\|\\*~_]/g, '').trim();";
  }
  if (lines[i].includes("innerComps.push({ type: 10, content: `-# **Channel:** [\\#${message.channel.name}](https://discord.com/channels/${message.guild.id}/${message.channel.id})` });")) {
    lines[i] = "    let safeChannel = message.channel.name.replace(/[\\[\\]\\|\\*~_]/g, '').trim();\n    innerComps.push({ type: 10, content: `-# **Channel:** [# ${safeChannel}](https://discord.com/channels/${message.guild.id}/${message.channel.id})` });";
  }
}
fs.writeFileSync("src/events/messageDelete.js", lines.join("\n"));

let modText = fs.readFileSync("src/commands/moderation.js", "utf8");
let modLines = modText.split("\n");
for (let i = 0; i < modLines.length; i++) {
  if (modLines[i].includes("logComps.push({ type: 10, content: `-# **Channel:** [${channel.name}](https://discord.com/channels/${guild.id}/${channel.id})` });")) {
    modLines[i] = "    let safeChannel = channel.name.replace(/[\\[\\]\\|\\*~_]/g, '').trim();\n    logComps.push({ type: 10, content: `-# **Channel:** [# ${safeChannel}](https://discord.com/channels/${guild.id}/${channel.id})` });";
  }
}
fs.writeFileSync("src/commands/moderation.js", modLines.join("\n"));

