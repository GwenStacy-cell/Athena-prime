import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");
js = js.replace(/embed\[color\]/g, "cv2[color]");
fs.writeFileSync("src/commands/security.js", js);
