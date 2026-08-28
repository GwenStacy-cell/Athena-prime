import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

// Change runStep to not wrap in **
code = code.replace(/finalStr \+= `\\n> -# \*\*\$\{result\}\*\*`;/g, "finalStr += result;");

// Update 'Connected'
code = code.replace(/return "Connected";/g, 'return "-# Connected";');

// Update DB pointer step
const oldDbStep = "return `\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u2570\\u203A Server Id : ${guild.id}\\n> -# **\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u2570\\u203A Athena Security DB ID : ${BigInt(guild.id) * 487293n}`;";
const newDbStep = "return `\\n> -# \\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u2570\\u203A Server Id : ${guild.id}\\n> -# \\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u00A0\\u2570\\u203A Athena Security DB ID : ${BigInt(guild.id) * 487293n}`;";

code = code.replace(oldDbStep, newDbStep);

fs.writeFileSync("src/commands/security.js", code);
console.log("Fixed DB pointers alignment and bold issues!");
