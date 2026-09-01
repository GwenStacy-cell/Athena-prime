import fs from "fs";
let text = fs.readFileSync("src/events/messageCreate.js", "utf8");
text = text.replace(/setMedia/g, "setURL");
fs.writeFileSync("src/events/messageCreate.js", text);
