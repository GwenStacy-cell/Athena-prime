import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

const fixed = `Creating DB for "\${guild.name}"\`, async () => { 
        return \`\\n\\u00A0\\u00A0\\u2570\\u203A Server Id : \${guild.id}\\n\\u00A0\\u00A0\\u2570\\u203A Secure Security DB ID : \${BigInt(guild.id) * 487293n}\`; 
    });
    const s4 = await runStep("Starting Role Integrity Check", async () => { return ""; });`;

code = code.replace(/Creating DB for.*?\);\s+const s4 = await runStep\("[^"]*", async \(\) => { return ""; }\);/s, fixed);

fs.writeFileSync("src/commands/security.js", code);
console.log("Fixed syntax really!");
