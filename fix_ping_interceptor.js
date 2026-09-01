import fs from "fs";
let code = fs.readFileSync("src/events/messageCreate.js", "utf8");

// We need to replace the entire ping interceptor block with a call to the actual ping command
const oldBlockStart = "if (message.content.toLowerCase().trim() === 'ping') {";
const regex = /if \(message\.content\.toLowerCase\(\)\.trim\(\) === 'ping'\) \{[\s\S]*?await message\.reply\(\{ embeds: \[e\], files: \[attachment\] \}\);\n      return;\n    \}/;

code = code.replace(regex, `if (message.content.toLowerCase().trim() === 'ping') {\n      const cmd = commandMap.get('ping');\n      if (cmd && cmd.executePrefix) {\n        await cmd.executePrefix(message, []);\n      }\n      return;\n    }`);

fs.writeFileSync("src/events/messageCreate.js", code);
