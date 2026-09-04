import fs from "fs";
let js = fs.readFileSync("src/commands/ccmd.js", "utf8");

js = js.replace(/return message\.reply\(\{ components: \[cv2\.buildContainer\('Custom Command Shortcuts', 'Configured aliases for this server:', fields\)\], flags: 16384 \}\);/,
"return message.reply(cv2.info('Custom Command Shortcuts', 'Configured aliases for this server:', fields));");

fs.writeFileSync("src/commands/ccmd.js", js);
