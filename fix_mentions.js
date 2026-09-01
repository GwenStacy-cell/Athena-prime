import fs from "fs";

// Fix security.js
let sec = fs.readFileSync("src/commands/security.js", "utf8");

sec = sec.replace(
    /value: \`\$\{targetMember\}\`/g,
    "value: `[${targetMember.user.username}](https://discord.com/users/${targetMember.id})`"
);

sec = sec.replace(
    /value: \`\$\{moderator\}\`/g,
    "value: `[${moderator.user?.username || 'System'}](https://discord.com/users/${moderator.id || moderator.user?.id})`"
);

sec = sec.replace(
    /value: \`\$\{quarantineChannel\}\`/g,
    "value: `[#${quarantineChannel.name}](https://discord.com/channels/${guild.id}/${quarantineChannel.id})`"
);

// executeUnquarantine (Quarantine Lifted text)
sec = sec.replace(
    /User: \$\{targetMember\} • Moderator: \$\{moderator\}/g,
    "User: [${targetMember.user.username}](https://discord.com/users/${targetMember.id}) • Moderator: [${moderator.user?.username || 'System'}](https://discord.com/users/${moderator.id || moderator.user?.id})"
);

// User Quarantined CV2 text
sec = sec.replace(
    /Hello \$\{targetMember\} ,/g,
    "Hello [${targetMember.user.username}](https://discord.com/users/${targetMember.id}) ,"
);

fs.writeFileSync("src/commands/security.js", sec);

// Fix messageCreate.js
let mc = fs.readFileSync("src/events/messageCreate.js", "utf8");

mc = mc.replace(
    /> Reason: \. \$\{message\.author\} ,/g,
    "> Reason: . [${message.author.username}](https://discord.com/users/${message.author.id}) ,"
);

fs.writeFileSync("src/events/messageCreate.js", mc);

// Fix interactionCreate.js
let intC = fs.readFileSync("src/events/interactionCreate.js", "utf8");

intC = intC.replace(
    /> \$\{interaction\.user\} Has Bypass " \$\{filterStr\} " For <@&\$\{targetRoleForBypass\}>/g,
    "-# > **[${interaction.user.username}](https://discord.com/users/${interaction.user.id})** Has Bypass **${filterStr}** For **@${interaction.guild.roles.cache.get(targetRoleForBypass)?.name || 'Role'}**"
);

fs.writeFileSync("src/events/interactionCreate.js", intC);

