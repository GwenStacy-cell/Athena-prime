import { commandMap } from './src/commands/loader.js';
const categories = new Set();
for (const cmd of commandMap.values()) {
    categories.add(cmd.category);
}
console.log("Existing Categories:", Array.from(categories).join(", "));
process.exit(0);
