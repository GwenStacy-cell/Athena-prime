import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

const start = code.indexOf("Creating DB for");
const end = code.indexOf("Starting Role Integrity Check");
const newBlock = "Creating DB for \"${guild.name}\"`, async () => { \n        return `\\n\\u00A0\\u00A0\\u2570\\u203A Server Id : ${guild.id}\\n\\u00A0\\u00A0\\u2570\\u203A Secure Security DB ID : ${BigInt(guild.id) * 487293n}`; \n    });\n    const s4 = await runStep(\"";

code = code.substring(0, start) + newBlock + code.substring(end + 30);
fs.writeFileSync("src/commands/security.js", code);
console.log("Fixed!");
