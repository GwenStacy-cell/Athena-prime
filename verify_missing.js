import fs from "fs";
import path from "path";

const commandsDir = "src/commands";
const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js') && f !== 'loader.js' && f !== 'utility.js');

let allCommands = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(commandsDir, file), "utf8");
  
  // Extract block for each command
  const matches = [...content.matchAll(/name:\s*['"]([^'"]+)['"]/g)];
  for (const m of matches) {
    const cmdName = m[1];
    const idx = m.index;
    const block = content.substring(Math.max(0, idx - 100), Math.min(content.length, idx + 200));
    
    if (block.includes("hidden: true") || block.includes("slashHidden: true")) continue;
    if (block.includes("category: 'owner'") || block.includes('category: "owner"')) continue;
    
    // Skip common false positives
    if (cmdName === 'target' || cmdName === 'user' || cmdName.includes(' ') || ['name', 'color', 'emoji', 'category', 'channel', 'reason', 'duration', 'page'].includes(cmdName)) continue;
    if (cmdName.length < 2) continue; // single letter false positives
    if (cmdName.includes('.png')) continue;
    
    allCommands.push(cmdName);
  }
}

const utilityCode = fs.readFileSync(path.join(commandsDir, 'utility.js'), 'utf8');
let missing = [];

for (const cmd of allCommands) {
  if (!utilityCode.includes(`!${cmd}`) && !utilityCode.includes(`/${cmd}`) && !utilityCode.includes(`${cmd} `) && !utilityCode.includes(` ${cmd}`)) {
    missing.push(cmd);
  }
}

console.log("Missing real command names:", [...new Set(missing)].sort());
