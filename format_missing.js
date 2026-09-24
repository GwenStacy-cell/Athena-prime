import { default as commandMap } from './src/commands/loader.js';
import fs from 'fs';

const helpCode = fs.readFileSync('./src/commands/utility.js', 'utf8');

const missingByCat = {};
for (const [name, cmd] of commandMap.entries()) {
    if (!helpCode.includes(name)) {
        const cat = cmd.category || 'General';
        if (!missingByCat[cat]) missingByCat[cat] = [];
        missingByCat[cat].push({ name, desc: cmd.description });
    }
}
console.log(JSON.stringify(missingByCat, null, 2));
