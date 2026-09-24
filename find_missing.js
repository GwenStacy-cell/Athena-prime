import { default as commandMap } from './src/commands/loader.js';
import fs from 'fs';

const helpCode = fs.readFileSync('./src/commands/utility.js', 'utf8');
const allCmds = Array.from(commandMap.keys());
const missing = [];

for (const cmd of allCmds) {
    if (!helpCode.includes(cmd)) {
        missing.push(cmd);
    }
}
console.log('Missing commands:', missing);
