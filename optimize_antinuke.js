import fs from "fs";
let js = fs.readFileSync("src/utils/antinuke.js", "utf8");

js = js.replace("await new Promise(r => setTimeout(r, 30));", "await new Promise(r => setTimeout(r, 10));");
js = js.replace("const VELOCITY_WINDOW_MS = 30_000;", "const VELOCITY_WINDOW_MS = 30_000;"); // Already threshold 1 anyway

fs.writeFileSync("src/utils/antinuke.js", js);
console.log("Optimized directStrike polling to 10ms");
