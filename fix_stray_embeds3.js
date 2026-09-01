import fs from "fs";
let text = fs.readFileSync("src/commands/rr.js", "utf8");

text = text.replace(/embeds: \[(cv2\.[a-zA-Z0-9_]+\([^\]]*\))\]/s, "...$1"); // no g flag?

fs.writeFileSync("src/commands/rr.js", text);
