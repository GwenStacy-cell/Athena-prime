import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

const target = "currentText += `\\n\\n| athena prime | athena firewall | athena unbypassable .\\n<@${guild.client.user.id}> is creating its backup role when anyone trying turn off admin , remove role , delete role the <@${guild.client.user.id}> will automatically enable admin , recovery its own role , adding itself making <@${guild.client.user.id}> unbypassable security system`;";

const injected = `    const db = (await import("../database.js")).default;
    db.updateGuildConfig(guild.id, { securityEnabled: true, antiNukeEnabled: true });
    
    ` + target;

code = code.replace(target, injected);
fs.writeFileSync("src/commands/security.js", code);
console.log("Injected DB trigger!");
