import fs from "fs";
let text = fs.readFileSync("src/utils/serverLogger.js", "utf8");
text = text.replace(
    "console.log(`[ServerLogger] Failed to send embed to ${targetChannelId}:`, err.message);",
    "console.log(`[ServerLogger] Failed to send embed to ${targetChannelId}:`, err.message);\n      require('fs').writeFileSync('logger_error.txt', err.stack + '\\n\\n' + JSON.stringify(payload, null, 2));"
);
fs.writeFileSync("src/utils/serverLogger.js", text);
