import fs from "fs";

let js = fs.readFileSync("src/commands/security.js", "utf8");

const oldCode3 = `antiSpamEnabled:   enable,
    antiInviteEnabled: enable,
    antiLinkEnabled:   enable,`;

const newCode3 = `antiSpamEnabled:   enable,
    antiInviteEnabled: false,
    antiLinkEnabled:   enable,`;

js = js.replace(oldCode3, newCode3);

// And wait, there's another place: handleAntinukeToggleAll
// Let's replace all occurrences globally
js = js.replaceAll(oldCode3, newCode3);

fs.writeFileSync("src/commands/security.js", js);
