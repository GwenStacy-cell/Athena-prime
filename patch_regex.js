import fs from "fs";

let text = fs.readFileSync("src/events/messageDelete.js", "utf8");

text = text.replace(
    /const name = \(mem\?\.displayName \|\| u\?\.globalName \|\| u\?\.username \|\| 'Unknown'\)\.replace\(\/[\s\S]*?\/g, ''\)\.trim\(\);/g,
    "const name = (mem?.displayName || u?.globalName || u?.username || 'Unknown').replace(/[\\x5B\\x5D|*~_]/g, '').trim();"
);

text = text.replace(
    /let safeChannel = message\.channel\.name\.replace\(\/[\s\S]*?\/g, ''\)\.trim\(\);/g,
    "let safeChannel = message.channel.name.replace(/[\\x5B\\x5D|*~_]/g, '').trim();"
);

fs.writeFileSync("src/events/messageDelete.js", text);

let modText = fs.readFileSync("src/commands/moderation.js", "utf8");
modText = modText.replace(
    /let safeChannel = channel\.name\.replace\(\/[\s\S]*?\/g, ''\)\.trim\(\);/g,
    "let safeChannel = channel.name.replace(/[\\x5B\\x5D|*~_]/g, '').trim();"
);
fs.writeFileSync("src/commands/moderation.js", modText);

