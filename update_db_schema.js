import fs from "fs";

let text = fs.readFileSync("src/database.js", "utf8");

// Add new automod defaults to getGuildConfig
const oldSchema = `        antiSpamMentionBypassRoles: [],
        antiLinkEnabled: false,
        antiInviteEnabled: true,
        raidMode: false,`;

const newSchema = `        antiSpamMentionBypassRoles: [],
        antiLinkEnabled: false,
        antiInviteEnabled: true,
        wordFilterEnabled: true,
        bigFontsEnabled: true,
        antiFloodEnabled: true,
        automodBypasses: {},
        honeypotChannelId: null,
        honeypotTimeoutMinutes: 15,
        raidMode: false,`;

text = text.replace(oldSchema, newSchema);

fs.writeFileSync("src/database.js", text);
