import fs from "fs";

let text = fs.readFileSync("src/commands/security.js", "utf8");

text = text.replace(
    ",\n      new ButtonBuilder().setCustomId('am_save').setLabel('Save').setStyle(ButtonStyle.Success)",
    ""
);

fs.writeFileSync("src/commands/security.js", text);
