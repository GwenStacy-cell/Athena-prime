import fs from "fs";
let intC = fs.readFileSync("src/events/interactionCreate.js", "utf8");

intC = intC.replace(
    /const isActive = getRecordingStatus\(interaction\.guild\.id\);/,
    "const isActive = getRecordingStatus(targetGuildId);"
);

fs.writeFileSync("src/events/interactionCreate.js", intC);
