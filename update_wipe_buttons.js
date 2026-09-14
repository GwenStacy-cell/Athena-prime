import fs from "fs";
let js = fs.readFileSync("src/commands/wipeemojis.js", "utf8");

js = js.replace(
  "new ButtonBuilder().setCustomId('confirm_wipe_emojis').setLabel('CONFIRM WIPE').setStyle(ButtonStyle.Danger)",
  "new ButtonBuilder().setCustomId('confirm_wipe_emojis').setLabel('CONFIRM WIPE').setStyle(ButtonStyle.Danger).setEmoji('1523766340752642109')"
);

js = js.replace(
  "new ButtonBuilder().setCustomId('cancel_wipe_emojis').setLabel('Cancel').setStyle(ButtonStyle.Secondary)",
  "new ButtonBuilder().setCustomId('cancel_wipe_emojis').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('1533860128015519895')"
);

fs.writeFileSync("src/commands/wipeemojis.js", js);
console.log("Updated button emojis!");
