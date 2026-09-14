import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

js = js.replace(
  "`!vcpanel` - Server Owner Voice Control Panel `[server owner]`",
  "`!vcpanel` - Voice Control Panel `[extra owners]`"
);

fs.writeFileSync("src/commands/utility.js", js);
console.log("Updated help menu description for vcpanel!");
