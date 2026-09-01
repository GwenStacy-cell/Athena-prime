import fs from "fs";

// Fix Ping (Prefix)
let util = fs.readFileSync("src/commands/utility.js", "utf8");
util = util.replace(
    "\\[${message.author.username}\\](https://discord.com/users/${message.author.id})",
    "\\[${message.member?.displayName || message.author.displayName}\\](https://discord.com/users/${message.author.id})"
);

// Fix Ping (Slash)
util = util.replace(
    "\\[${interaction.user.username}\\](https://discord.com/users/${interaction.user.id})",
    "\\[${interaction.member?.displayName || interaction.user.displayName}\\](https://discord.com/users/${interaction.user.id})"
);

fs.writeFileSync("src/commands/utility.js", util);

// Fix AFK Set (Prefix)
let afk = fs.readFileSync("src/commands/afk.js", "utf8");
afk = afk.replace(
    "${message.author.username} is now AFK",
    "${message.member?.displayName || message.author.displayName} is now AFK"
);
fs.writeFileSync("src/commands/afk.js", afk);

// Fix AFK Remove/Mention (messageCreate.js)
let mc = fs.readFileSync("src/events/messageCreate.js", "utf8");
mc = mc.replace(
    "\\[${message.author.username}\\](https://discord.com/users/${message.author.id}) removed their Afk",
    "\\[${message.member?.displayName || message.author.displayName}\\](https://discord.com/users/${message.author.id}) removed their Afk"
);
mc = mc.replace(
    "\\[${user.username}\\](https://discord.com/users/${user.id}) is Afk",
    "\\[${message.guild?.members.cache.get(user.id)?.displayName || user.displayName}\\](https://discord.com/users/${user.id}) is Afk"
);
fs.writeFileSync("src/events/messageCreate.js", mc);

