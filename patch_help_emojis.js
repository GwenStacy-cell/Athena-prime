import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

js = js.replace(
  "`!enuke` - Delete all emojis `[extra owners]`",
  "`!wipeemojis` - Delete all custom emojis from the server `[extra owners]`"
);

fs.writeFileSync("src/commands/utility.js", js);
console.log("Updated help menu!");
