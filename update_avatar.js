import fs from "fs";
let js = fs.readFileSync("src/commands/autoreact.js", "utf8");

const oldAvatar = `client?.user?.displayAvatarURL({ extension: 'png' }) || 'https://cdn.discordapp.com/embed/avatars/0.png'`;
const newAvatar = `client?.guilds.cache.get(guildId)?.members.me?.displayAvatarURL({ extension: 'png' }) || client?.user?.displayAvatarURL({ extension: 'png' }) || 'https://cdn.discordapp.com/embed/avatars/0.png'`;

js = js.replace(oldAvatar, newAvatar);
fs.writeFileSync("src/commands/autoreact.js", js);
