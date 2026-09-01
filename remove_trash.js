import fs from "fs";
let text = fs.readFileSync("src/events/messageDelete.js", "utf8");
text = text.replace(
    "const title = isGhostPing ? '<a:st_Ghost:1543537892717105212> **GHOST PING DETECTED**' : '🗑️ **Message Sniped**';",
    "const title = isGhostPing ? '<a:st_Ghost:1543537892717105212> **GHOST PING DETECTED**' : '**Message Sniped**';"
);
fs.writeFileSync("src/events/messageDelete.js", text);
