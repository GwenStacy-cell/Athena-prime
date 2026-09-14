import fs from "fs";

let js = fs.readFileSync("src/commands/utility.js", "utf8");

js = js.replace(
  "> <a:z_arrow_pink1:1523082728004653138> **Hint : To Know more use \" Tag the Bot and Type Guide for details and usage \"**",
  "> <a:z_arrow_pink1:1523082728004653138> **Hint: For a detailed guide and instruction on any specific command, type \`${prefix}help <command>\` !**"
);

fs.writeFileSync("src/commands/utility.js", js);
console.log("Updated hint text for detailed guides!");
