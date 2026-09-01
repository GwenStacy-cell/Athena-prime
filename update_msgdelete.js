import fs from "fs";

let text = fs.readFileSync("src/events/messageDelete.js", "utf8");

const replacement = `
    if (!message.guild) return;

    if (message.client.ignoredDeletes && message.client.ignoredDeletes.has(message.id)) {
      message.client.ignoredDeletes.delete(message.id);
      return; // Suppress individual log because this is being bulk-logged by Purge
    }
`;

text = text.replace("    if (!message.guild) return;", replacement.trim());
fs.writeFileSync("src/events/messageDelete.js", text);
