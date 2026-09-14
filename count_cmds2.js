import { commandMap } from './src/commands/loader.js';

const uniqueCommands = new Set();
let totalAliases = 0;

for (const [key, cmd] of commandMap.entries()) {
    uniqueCommands.add(cmd.name);
    if (key !== cmd.name) {
        totalAliases++;
    }
}

console.log(`Unique Base Commands: ${uniqueCommands.size}`);
console.log(`Aliases / Shortcuts: ${totalAliases}`);
console.log(`Total Triggers (Every Single Command): ${commandMap.size}`);
process.exit(0);
