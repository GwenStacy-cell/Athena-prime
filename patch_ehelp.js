import fs from "fs";
let js = fs.readFileSync("src/commands/ezal.js", "utf8");

js = js.replace(
  /'\`ezal servers\` - List all servers the bot is in with their backup IDs and stats\\n' \+/g,
  `'\`ezal servers\` - List all servers the bot is in with their backup IDs and stats\\n' +\n          '\`ezal invite <serverId>\` - Generate a remote invite link for a server\\n' +`
);

fs.writeFileSync("src/commands/ezal.js", js);
