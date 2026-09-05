import fs from "fs";
let js = fs.readFileSync("src/commands/ezal.js", "utf8");

js = js.replace(
  /\`ezal invite <serverId>\`/g,
  `\`ezal invite <guild_id>\``
);

fs.writeFileSync("src/commands/ezal.js", js);
