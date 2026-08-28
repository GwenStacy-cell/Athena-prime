
import fs from "fs";

let sec = fs.readFileSync("src/commands/security.js", "utf8");

const oldText = `const text = "**List Dangerous Roles:** " + rolesStr + "\\n" +
                   "**List Bots:** " + formatList(allBots) + "\\n" +
                   "**Humans Having Dangerous roles:** " + formatList(humansWithDangerousRoles) + "\\n" +
                   "**Bots Having dangeurs roles:** " + formatList(botsWithDangerousRoles) + "\\n" +
                   "**Production Level Bots:** " + formatList(productionBots) + "\\n\\n" +
                   "**2FA Notification Gmail:** \`" + twoFactorEmail + "\`";`;

const newText = `const text = "List Dangerous Roles : " + rolesStr + "\\n" +
                   "List Bots : " + formatList(allBots) + "\\n" +
                   "Humans Having Dangerous roles : " + formatList(humansWithDangerousRoles) + "\\n" +
                   "Bots Having dangeurs roles : " + formatList(botsWithDangerousRoles) + "\\n" +
                   "Production Level Bots : " + formatList(productionBots) + "\\n\\n" +
                   "2FA Notification Gmail: \`" + twoFactorEmail + "\`";`;

sec = sec.replace(oldText, newText);

fs.writeFileSync("src/commands/security.js", sec);
console.log("Fixed dashboard text design");

