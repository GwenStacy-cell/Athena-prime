import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

js = js.replace(
  /'\`!emergency\` \*\*mode\*\* \/ \*\*end\*\* \?" Strip dangerous permissions and hide channels \`\[extra owners\]\`',/g,
  `'\`!emergency\` **mode** / **end** ?" Strip dangerous permissions and hide channels \`[extra owners]\`', '\`!learn\` ?" Neural Network Nuke Signature Training \`[extra owners]\`',`
);

fs.writeFileSync("src/commands/utility.js", js);
