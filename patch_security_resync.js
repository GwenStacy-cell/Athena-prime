import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

// We need to remove the early return for both executePrefix and executeSlash
js = js.replace(
  /if \(config\.securityEnabled\) \{\s*return message\.reply\(cv2\.warn\('Security Active', 'Security is already enabled on this server\.'\)\);\s*\}/g,
  `if (config.securityEnabled) {\n            // Do not block, force synchronization instead\n          }`
);

js = js.replace(
  /if \(config\.securityEnabled\) \{\s*return interaction\.reply\(cv2\.warn\('Security Active', 'Security is already enabled on this server\.'\)\);\s*\}/g,
  `if (config.securityEnabled) {\n            // Do not block, force synchronization instead\n          }`
);

fs.writeFileSync("src/commands/security.js", js);
