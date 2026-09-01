import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");
text = text.replace(/durationMs\u2570\u203A formatDuration/g, "durationMs ? formatDuration");
text = text.replace(/durationMs.*formatDuration/g, "durationMs ? formatDuration");
text = text.replace(/const durationLabel = durationMs.*/g, "const durationLabel = durationMs ? formatDuration(durationMs) : 'Until manually lifted';");
fs.writeFileSync("src/commands/security.js", text);
