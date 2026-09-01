import fs from "fs";

// 1. Extract all documented commands from utility.js helpModules
let utilityStr = fs.readFileSync("src/commands/utility.js", "utf8");
let helpModulesStr = utilityStr.split("const helpModules = [")[1].split("];")[0];

let documented = new Set();
let matches = [...helpModulesStr.matchAll(/`[!/]([a-z]+)`/g)];
matches.forEach(m => documented.add(m[1]));
// Also catch commands documented like `!ban` / `!unban`
let looseMatches = [...helpModulesStr.matchAll(/!([a-z]+)/g)];
looseMatches.forEach(m => documented.add(m[1]));
let slashMatches = [...helpModulesStr.matchAll(/\/([a-z]+)/g)];
slashMatches.forEach(m => documented.add(m[1]));


// 2. Extract all actual command names from src/commands/*.js
let actualCommands = new Set();
let files = fs.readdirSync("src/commands").filter(f => f.endsWith(".js"));

files.forEach(f => {
  let content = fs.readFileSync("src/commands/" + f, "utf8");
  // Look for name: 'cmd'
  let cmdMatches = [...content.matchAll(/name:\s*'([a-z]+)'/g)];
  cmdMatches.forEach(m => actualCommands.add(m[1]));
});

console.log("Commands NOT documented in the Help menu:");
actualCommands.forEach(cmd => {
  if (!documented.has(cmd)) {
    console.log("- " + cmd);
  }
});
