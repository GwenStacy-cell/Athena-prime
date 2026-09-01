import fs from "fs";

// Fix interactionCreate.js
let intC = fs.readFileSync("src/events/interactionCreate.js", "utf8");
intC = intC.replace(
    /\[\$\{interaction\.user\.username\}\]/g,
    "[${interaction.member?.displayName || interaction.user.displayName || interaction.user.username}]"
);
intC = intC.replace(
    /\*\*@\$\{interaction\.guild\.roles\.cache\.get\(targetRoleForBypass\)\?\.name \|\| 'Role'\}\*\*/g,
    "<@&${targetRoleForBypass}>"
);
fs.writeFileSync("src/events/interactionCreate.js", intC);

// Fix messageCreate.js
let mc = fs.readFileSync("src/events/messageCreate.js", "utf8");
mc = mc.replace(
    /\[\$\{message\.author\.username\}\]/g,
    "[${message.member?.displayName || message.author.displayName || message.author.username}]"
);
fs.writeFileSync("src/events/messageCreate.js", mc);

// Fix security.js
let sec = fs.readFileSync("src/commands/security.js", "utf8");
sec = sec.replace(
    /targetMember\.user\.username/g,
    "targetMember.displayName"
);
sec = sec.replace(
    /\[\$\{moderator\.user\?\.username \|\| 'System'\}\]/g,
    "[${moderator.displayName || moderator.user?.username || 'System'}]"
);
fs.writeFileSync("src/commands/security.js", sec);
