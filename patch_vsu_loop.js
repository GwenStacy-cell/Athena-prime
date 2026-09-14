import fs from "fs";
let js = fs.readFileSync("src/events/voiceStateUpdate.js", "utf8");

js = js.replace(/connectToHomeVc\(guild, homeVcId, true\);/g, "connectToHomeVc(guild, homeVcId, false);");

fs.writeFileSync("src/events/voiceStateUpdate.js", js);
