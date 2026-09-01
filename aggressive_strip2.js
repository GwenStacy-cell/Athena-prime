import fs from "fs";

let text = fs.readFileSync("src/commands/moderation.js", "utf8");

text = text.replace(
    /let safeChannel = channel\.name\.replace\(\/\[\\x5B\\x5D\|\*~_\]\/g, ''\)\.trim\(\);/g,
    "let safeChannel = channel.name.replace(/[^a-zA-Z0-9\\- ]/g, '').trim();\n    if (!safeChannel) safeChannel = 'Channel';"
);

fs.writeFileSync("src/commands/moderation.js", text);
