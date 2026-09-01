import fs from "fs";
let text = fs.readFileSync("src/events/messageDelete.js", "utf8");

text = text.replace(
    "import { AuditLogEvent, MessageFlags } from 'discord.js';",
    "import { AuditLogEvent } from 'discord.js';"
);

text = text.replace(
    "flags: MessageFlags.IsComponentsV2",
    "flags: 32768"
);

// Fix type 12 nesting
text = text.replace(
    "if (imageUrl) {\n      payload.components.push({ type: 12, items: [{ media: { url: imageUrl } }] });\n    }",
    "if (imageUrl) {\n      payload.components[0].components.push({ type: 12, items: [{ media: { url: imageUrl } }] });\n    }"
);

fs.writeFileSync("src/events/messageDelete.js", text);
