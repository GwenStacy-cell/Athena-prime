import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

text = text.replace(
    "`-# **| Max Warnings Threshold:** ${config.maxWarnings || 3}\\n` +",
    "`-# **| Max Warnings Threshold:** ${config.maxWarnings || 3} *(Use \\`!maxwarnings <number>\\` to modify)*\\n` +"
);

fs.writeFileSync("src/commands/security.js", text);
