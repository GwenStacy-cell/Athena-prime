import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

const target = `const commandName = args.shift().toLowerCase();`;
const replace = `let commandName = args.shift().toLowerCase();
    
    const guildConfig = db.getGuildConfig(message.guild.id);
    const ccmds = guildConfig?.customCommands || {};
    if (ccmds[commandName]) {
      commandName = ccmds[commandName];
    }`;

js = js.replace(target, replace);
fs.writeFileSync("src/events/messageCreate.js", js);
