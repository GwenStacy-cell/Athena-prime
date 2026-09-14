import fs from "fs";
let js = fs.readFileSync("src/utils/antinuke.js", "utf8");

const botAddOld = `guild.members.ban(targetId, { reason: 'Athena Anti-Nuke: Unauthorized bot addition' }).catch(() => null);`;
const botAddNew = `rawBan(guild.id, targetId, guild.client.token, 'Athena Anti-Nuke: Unauthorized bot addition').catch(() => null);`;

if (js.includes(botAddOld)) {
    js = js.replace(botAddOld, botAddNew);
    fs.writeFileSync("src/utils/antinuke.js", js);
    console.log("Upgraded BotAdd to use rawBan!");
} else {
    console.log("Not found!");
}
