import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

const oldCode = `      db.updateGuildConfig(guild.id, {
        securityEnabled: true,
        antiNukeEnabled: true,
        antiInviteEnabled: true,
        antiSpamMentionEnabled: true,
        antiLinkEnabled: true,
        antiFloodEnabled: true,
        wordFilterEnabled: true,
        antinukeModules: modules
      });
    
      await sendPayload(true, false);
}`;

const newCode = `      db.updateGuildConfig(guild.id, {
        securityEnabled: true,
        antiNukeEnabled: true,
        antiInviteEnabled: true,
        antiSpamMentionEnabled: true,
        antiLinkEnabled: true,
        antiFloodEnabled: true,
        wordFilterEnabled: true,
        antinukeModules: modules
      });
    
      await sendPayload(true, false);
      return true;
}`;

if (js.includes(oldCode)) {
    js = js.replace(oldCode, newCode);
    fs.writeFileSync("src/commands/security.js", js);
    console.log("Success!");
} else {
    console.log("Failed to find code.");
}
