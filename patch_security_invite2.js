import fs from "fs";

let js = fs.readFileSync("src/commands/security.js", "utf8");

const oldCode2 = `const isEnabled = isSecured && (moduleFlag === undefined ? true : !!moduleFlag);`;
const newCode2 = `const isEnabled = isSecured && (moduleFlag === undefined ? (k === 'antiInvite' ? false : true) : !!moduleFlag);`;

js = js.replace(oldCode2, newCode2);

fs.writeFileSync("src/commands/security.js", js);
