import fs from "fs";
let text = fs.readFileSync("src/commands/moderation.js", "utf8");
text = text.replace(
    "Athena Advanced Server Diagnostics",
    "Athena Diagnostic Logs"
);
fs.writeFileSync("src/commands/moderation.js", text);
