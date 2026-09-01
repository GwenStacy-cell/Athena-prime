import fs from "fs";
let si = fs.readFileSync("src/commands/si.js", "utf8");

si = si.replace(
    /owner \? owner\.user\.toString\(\) : 'Unknown'/,
    "owner ? `[${owner.displayName || owner.user.username}](https://discord.com/users/${owner.id})` : 'Unknown'"
);

fs.writeFileSync("src/commands/si.js", si);
