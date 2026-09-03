import fs from "fs";
let js = fs.readFileSync("src/utils/voice.js", "utf8");

// Use regex to match the broken emoji ID safely
js = js.replace(/<a:[^:]+:1451690277126275267>/g, "<a:Beloved_chidharha:1544998293153779722>");

fs.writeFileSync("src/utils/voice.js", js);
