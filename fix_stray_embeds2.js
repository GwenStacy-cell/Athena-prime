import fs from "fs";
let text = fs.readFileSync("src/commands/rr.js", "utf8");
text = text.replace(/embeds: \[(cv2\.[a-zA-Z0-9_]+\([^\]]*\))\]/g, "...$1");
fs.writeFileSync("src/commands/rr.js", text);

let text2 = fs.readFileSync("src/commands/vcdrag.js", "utf8");
text2 = text2.replace(/embeds: \[(cv2\.[a-zA-Z0-9_]+\([^\]]*\))\]/g, "...$1");
fs.writeFileSync("src/commands/vcdrag.js", text2);
