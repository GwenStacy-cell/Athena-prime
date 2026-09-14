import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

js = js.replace(
  /const modules = config\.antinukeModules \|\| \{\};\s*for \(const key in modules\) \{\s*modules\[key\] = true;\s*\}/g,
  `const modules = config.antinukeModules || {};\n      const allKeys = ['antiRoleCreate', 'antiRoleDelete', 'antiRoleUpdate', 'antiRolePermUpdate', 'antiMemberRoleUpdate', 'antiRoleReorder', 'antiChannelCreate', 'antiChannelDelete', 'antiChannelUpdate', 'antiChannelPermUpdate', 'antiChannelReorder', 'antiChannelNameMod', 'antiEmojiCreate', 'antiEmojiDelete', 'antiEmojiUpdate', 'antiWebhooks', 'antiBotAdd', 'antiServerUpdate', 'antiBan', 'antiKick', 'antiUnban', 'antiInvite', 'antiScheduledEvents', 'antiMemberPurge', 'antiMassBan', 'antiAutomodUpdate', 'antiAppCommands'];\n      for (const k of allKeys) {\n        modules[k] = true;\n      }`
);

fs.writeFileSync("src/commands/security.js", js);
