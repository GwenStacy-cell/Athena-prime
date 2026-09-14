import fs from "fs";

let js = fs.readFileSync("src/commands/utility.js", "utf8");

// Add roleplay commands
js = js.replace(
  "`!hug / !kiss / !slap / !pat` - Interact with users `[public]`",
  "`!hug / !kiss / !slap / !pat / !bite / !cuddle / !wink / !bonk / !bully / !cry / !handhold / !highfive / !nom / !poke` - Interact with users `[public]`"
);

// Add botgrowth commands
js = js.replace(
  "`!status` - Security health overview `[public]`",
  "`!status` - Security health overview `[public]`\", \"`!bjoins / !bleaves / !bsummary` - View bot growth stats `[public]`\", \"`!bcmds` - View most used commands `[public]`\", \"`!bservers` - View all servers the bot is in `[public]`"
);

fs.writeFileSync("src/commands/utility.js", js);
console.log("Injected missing commands into help menu!");
