import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");
js = js.replace(/if\s*\(customId\s*===\s*'toggle_invite'\)\s*\{\s*updateData\.antiInviteEnabled\s*=\s*\([^)]*\)\s*\?\s*true\s*:\s*false;\s*updated\s*=\s*true;\s*\}/,
`if (customId === 'toggle_invite') {
          updateData.antiInviteEnabled = (config.antiInviteEnabled === true) ? false : true;
          updated = true;
        }`);
fs.writeFileSync("src/events/interactionCreate.js", js);
