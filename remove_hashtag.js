import fs from "fs";

let text = fs.readFileSync("src/events/messageDelete.js", "utf8");
text = text.replace(
    /\[# \$\{safeChannel\}\]/g,
    "[${safeChannel}]"
);
fs.writeFileSync("src/events/messageDelete.js", text);

let modText = fs.readFileSync("src/commands/moderation.js", "utf8");
modText = modText.replace(
    /\[# \$\{safeChannel\}\]/g,
    "[${safeChannel}]"
);
fs.writeFileSync("src/commands/moderation.js", modText);

