import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

const target = `let commandName = args.shift().toLowerCase();`;
const replace = `let commandName = args.shift().toLowerCase();

  // Custom Command Aliases (Shortcuts)
  const ccmds = config.customCommands || {};
  if (ccmds[commandName]) {
    commandName = ccmds[commandName];
  }`;

js = js.replace(target, replace);
fs.writeFileSync("src/events/messageCreate.js", js);
