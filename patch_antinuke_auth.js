import fs from "fs";
let js = fs.readFileSync("src/utils/antinuke.js", "utf8");

js = js.replace(
  /if \(isAuthorized\(guild, executor\)\) return;/g,
  `if (isAuthorized(guild, executor) && !config.learnModeEnabled) return;`
);

js = js.replace(
  /if \(isAuthorized\(guild, executor, eventType\)\) return;/g,
  `if (isAuthorized(guild, executor, eventType) && !config.learnModeEnabled) return;`
);

fs.writeFileSync("src/utils/antinuke.js", js);
