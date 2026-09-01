import fs from "fs";

let js = fs.readFileSync("src/commands/security.js", "utf8");

const oldCode2 = `const inviteState = config.antiInviteEnabled !== false;`;
const newCode2 = `const inviteState = config.antiInviteEnabled === true;`;

js = js.replace(oldCode2, newCode2);

fs.writeFileSync("src/commands/security.js", js);
