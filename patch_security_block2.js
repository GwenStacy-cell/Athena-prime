import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

// Prefix version
js = js.replace(
  /if \(enable\) \{\s*const config = db\.getGuildConfig\(message\.guild\.id\);\s*if \(config\.securityEnabled\) \{\s*\/\/ Do not block, force synchronization instead\s*\}/g,
  `if (enable) {\n          const config = db.getGuildConfig(message.guild.id);\n          if (config.securityEnabled) {\n            return message.reply(cv2.warn('Security Active', 'Security is already enabled on this server. To re-enable or refresh the system, please use \`!security disable all\` first, and then run \`!security enable all\` again.'));\n          }`
);

// Slash version
js = js.replace(
  /if \(enable\) \{\s*const config = db\.getGuildConfig\(interaction\.guild\.id\);\s*if \(config\.securityEnabled\) \{\s*\/\/ Do not block, force synchronization instead\s*\}/g,
  `if (enable) {\n          const config = db.getGuildConfig(interaction.guild.id);\n          if (config.securityEnabled) {\n            return interaction.reply(cv2.warn('Security Active', 'Security is already enabled on this server. To re-enable or refresh the system, please use \`/security disable_all\` first, and then run \`/security enable_all\` again.'));\n          }`
);

fs.writeFileSync("src/commands/security.js", js);
