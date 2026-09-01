import fs from "fs";

let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const oldCode = `if (customId === 'toggle_invite') {
          updateData.antiInviteEnabled = (config.antiInviteEnabled === false) ? true : false;
          updated = true;
        }`;

const newCode = `if (customId === 'toggle_invite') {
          const newVal = (config.antiInviteEnabled === false) ? true : false;
          updateData.antiInviteEnabled = newVal;
          updateData.antinukeModules = { ...(config.antinukeModules || {}), antiInvite: newVal };
          updated = true;
        }`;

js = js.replace(oldCode, newCode);

fs.writeFileSync("src/events/interactionCreate.js", js);
