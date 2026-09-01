import fs from "fs";

let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const oldCode4 = `const newVal = (config.antiInviteEnabled === false) ? true : false;`;
const newCode4 = `const newVal = (config.antiInviteEnabled === true) ? false : true;`;

js = js.replace(oldCode4, newCode4);

fs.writeFileSync("src/events/interactionCreate.js", js);
