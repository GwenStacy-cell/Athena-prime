import fs from "fs";
let code = fs.readFileSync("src/utils/mailer.js", "utf8");

code = code.replace(/const mailOptions = \{/g, 'console.log(`\\n\\n[SECURITY] 2FA CODE FOR ${guildName}: ${code}\\n\\n`);\n  const mailOptions = {');

fs.writeFileSync("src/utils/mailer.js", code);
console.log("Injected console logging for 2FA codes!");
