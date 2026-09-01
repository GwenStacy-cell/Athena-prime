import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

text = text.replace(
    `# AUTOMATED MODERATION & SECURITY MATRIX\\n`,
    `# AUTOMOD | HEURISTIC FILTERING & SECURITY MATRIX\\n`
);

fs.writeFileSync("src/commands/security.js", text);
