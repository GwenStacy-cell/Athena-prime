import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

// Fix the literal '-# Connected'
code = code.replace(/return "-# Connected";/g, 'return "Connected";');

// Fix the indentation using Braille Blank (\u2800) instead of Non-Breaking Spaces
// Braille Blank is treated as a solid letter by Discord, so markdown headers cannot strip it!
const oldDbStep = "return `\\n> -# \\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u2570\\u203A Server Id : ${guild.id}\\n> -# \\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u2570\\u203A Athena Security DB ID : ${BigInt(guild.id) * 487293n}`;";
const newDbStep = "return `\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A Server Id : ${guild.id}\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A Athena Security DB ID : ${BigInt(guild.id) * 487293n}`;";

code = code.replace(oldDbStep, newDbStep);

fs.writeFileSync("src/commands/security.js", code);
console.log("Fixed literal tag and used Braille Blank for indentation!");
