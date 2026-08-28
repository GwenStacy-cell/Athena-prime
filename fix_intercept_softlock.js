import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

code = code.replace(/await send2FACode\(config\.twoFactorEmail, code2fa, message\.guild\.name\);/g, "send2FACode(config.twoFactorEmail, code2fa, message.guild.name).catch(e => console.log('SMTP Blocked:', e.message));");
code = code.replace(/await send2FACode\(config\.twoFactorEmail, code2fa, interaction\.guild\.name\);/g, "send2FACode(config.twoFactorEmail, code2fa, interaction.guild.name).catch(e => console.log('SMTP Blocked:', e.message));");

fs.writeFileSync("src/commands/security.js", code);
console.log("Fixed intercept softlocks!");
