import fs from "fs";
import path from "path";

const dir = "src/commands";
const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));

let allCommands = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), "utf8");
  
  // Extract block for each command
  const matches = [...content.matchAll(/name:\s*['"]([^'"]+)['"]/g)];
  for (const m of matches) {
    const cmdName = m[1];
    
    // Find the object block around this name
    const idx = m.index;
    const block = content.substring(Math.max(0, idx - 100), Math.min(content.length, idx + 200));
    
    if (block.includes("hidden: true") || block.includes("slashHidden: true")) continue;
    if (block.includes("category: 'owner'") || block.includes('category: "owner"')) continue;
    
    // Skip common false positives (like embed field names)
    if (cmdName === 'target' || cmdName === 'user' || cmdName.includes(' ')) continue;
    
    allCommands.push(cmdName);
  }
}

const utilityCode = fs.readFileSync("src/commands/utility.js", "utf8");
let missing = [];

for (const cmd of allCommands) {
  if (!utilityCode.includes(`!${cmd}`) && !utilityCode.includes(`/${cmd}`) && !utilityCode.includes(`${cmd} `) && !utilityCode.includes(`${cmd}\``)) {
    missing.push(cmd);
  }
}

console.log("Missing public commands:", [...new Set(missing)].sort());
