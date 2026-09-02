import fs from "fs";
let js = fs.readFileSync("src/commands/welcome.js", "utf8");
js = js.replace(/cv2\.e\./g, "cv2.");
fs.writeFileSync("src/commands/welcome.js", js);
