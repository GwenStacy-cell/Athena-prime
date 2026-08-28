import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

// Replace \u00A0 with \u2003 (Em Space) for much wider indentation
const oldDbStep = "return `\\n> -# \\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u2570\\u203A Server Id : ${guild.id}\\n> -# \\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u2570\\u203A Athena Security DB ID : ${BigInt(guild.id) * 487293n}`;";
const newDbStep = "return `\\n> -# \\u2003\\u2003\\u2003\\u2003\\u2003\\u2570\\u203A Server Id : ${guild.id}\\n> -# \\u2003\\u2003\\u2003\\u2003\\u2003\\u2570\\u203A Athena Security DB ID : ${BigInt(guild.id) * 487293n}`;";

code = code.replace(oldDbStep, newDbStep);

fs.writeFileSync("src/commands/security.js", code);
console.log("Fixed DB pointer spacing with Em Spaces!");
