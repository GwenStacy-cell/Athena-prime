import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

js = js.replace(
  /if \(config\.securityEnabled\) \{\s*\/\/ Do not block, force synchronization instead\s*\}/g,
  `if (config.securityEnabled) {\n            return message.reply(cv2.warn('Security Active', 'Security is already enabled on this server. To re-enable or refresh the system, please use \`!security disable all\` first, and then run \`!security enable all\` again.'));\n          }`
);

// We need to handle the slash command version too, which uses interaction.reply
js = js.replace(
  /if \(config\.securityEnabled\) \{\s*return interaction\.reply\(cv2\.warn\('Security Active', 'Security is already enabled on this server\..*?\)\);\s*\}/g,
  `if (config.securityEnabled) {\n            return interaction.reply(cv2.warn('Security Active', 'Security is already enabled on this server. To re-enable or refresh the system, please use \`/security disable_all\` first, and then run \`/security enable_all\` again.'));\n          }`
);

// Wait, the previous patch might have left the interaction.reply block intact but replaced the // Do not block comment.
