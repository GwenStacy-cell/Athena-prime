import fs from "fs";

let text = fs.readFileSync("src/events/messageDelete.js", "utf8");

text = text.replace(
    /let safeChannel = message\.channel\.name\.replace\(\/\[\\x5B\\x5D\|\*~_\]\/g, ''\)\.trim\(\);/g,
    "let safeChannel = message.channel.name.replace(/[^a-zA-Z0-9\\- ]/g, '').trim();\n      if (!safeChannel) safeChannel = 'Channel';"
);

fs.writeFileSync("src/events/messageDelete.js", text);
