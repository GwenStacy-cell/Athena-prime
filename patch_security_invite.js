import fs from "fs";

let js = fs.readFileSync("src/commands/security.js", "utf8");

const oldCode = `for (const key of allKeys) {
    updates.antinukeModules[key] = enable;
  }`;

const newCode = `for (const key of allKeys) {
    if (key === 'antiInvite') {
      updates.antinukeModules[key] = false;
    } else {
      updates.antinukeModules[key] = enable;
    }
  }`;

js = js.replace(oldCode, newCode);

fs.writeFileSync("src/commands/security.js", js);
