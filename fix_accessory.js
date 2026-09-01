import fs from "fs";
let text = fs.readFileSync("src/events/messageCreate.js", "utf8");
text = text.replace(/\.setAccessory\(/g, ".setThumbnailAccessory(");
fs.writeFileSync("src/events/messageCreate.js", text);
