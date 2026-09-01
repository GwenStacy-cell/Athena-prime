import fs from "fs";
let text = fs.readFileSync("src/database.js", "utf8");

text = text.replace(
"        antiLinkEnabled: false,\n        antiInviteEnabled: true,\n        raidMode: false,",
"        antiLinkEnabled: false,\n        antiInviteEnabled: true,\n        wordFilterEnabled: true,\n        bigFontsEnabled: true,\n        antiFloodEnabled: true,\n        automodBypasses: {},\n        honeypotChannelId: null,\n        honeypotTimeoutMinutes: 15,\n        raidMode: false,"
);

text = text.replace(
"        if (cfg.antiLinkEnabled === undefined) { cfg.antiLinkEnabled = false; updated = true; }",
"        if (cfg.antiLinkEnabled === undefined) { cfg.antiLinkEnabled = false; updated = true; }\n        if (cfg.wordFilterEnabled === undefined) { cfg.wordFilterEnabled = true; updated = true; }\n        if (cfg.bigFontsEnabled === undefined) { cfg.bigFontsEnabled = true; updated = true; }\n        if (cfg.antiFloodEnabled === undefined) { cfg.antiFloodEnabled = true; updated = true; }\n        if (cfg.automodBypasses === undefined) { cfg.automodBypasses = {}; updated = true; }\n        if (cfg.honeypotChannelId === undefined) { cfg.honeypotChannelId = null; updated = true; }\n        if (cfg.honeypotTimeoutMinutes === undefined) { cfg.honeypotTimeoutMinutes = 15; updated = true; }"
);

fs.writeFileSync("src/database.js", text);
