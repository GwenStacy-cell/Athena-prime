import fs from "fs";
let text = fs.readFileSync("src/database.js", "utf8");

text = text.replace(/antiLinkEnabled: false,\s*antiInviteEnabled: true,\s*raidMode: false,/,
`antiLinkEnabled: false,
        antiInviteEnabled: true,
        wordFilterEnabled: true,
        bigFontsEnabled: true,
        antiFloodEnabled: true,
        automodBypasses: {},
        honeypotChannelId: null,
        honeypotTimeoutMinutes: 15,
        raidMode: false,`);

text = text.replace(/if \(cfg\.antiLinkEnabled === undefined\) \{ cfg\.antiLinkEnabled = false; updated = true; \}/,
`if (cfg.antiLinkEnabled === undefined) { cfg.antiLinkEnabled = false; updated = true; }
        if (cfg.wordFilterEnabled === undefined) { cfg.wordFilterEnabled = true; updated = true; }
        if (cfg.bigFontsEnabled === undefined) { cfg.bigFontsEnabled = true; updated = true; }
        if (cfg.antiFloodEnabled === undefined) { cfg.antiFloodEnabled = true; updated = true; }
        if (cfg.automodBypasses === undefined) { cfg.automodBypasses = {}; updated = true; }
        if (cfg.honeypotChannelId === undefined) { cfg.honeypotChannelId = null; updated = true; }
        if (cfg.honeypotTimeoutMinutes === undefined) { cfg.honeypotTimeoutMinutes = 15; updated = true; }`);

fs.writeFileSync("src/database.js", text);
