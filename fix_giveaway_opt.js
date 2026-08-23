import fs from 'fs';
let code = fs.readFileSync('src/commands/giveaway.js', 'utf8');

const targetStr = "{ name: 'message', description: 'Optional custom message', type: 3, required: false }";
const replacementStr = `{ name: 'message', description: 'Optional custom message', type: 3, required: false },
            { 
              name: 'mode', 
              description: 'Winner Selection Mode', 
              type: 3, 
              required: false,
              choices: [
                { name: 'Random (Classic)', value: 'random' },
                { name: 'Most Messages in Channel', value: 'messages' },
                { name: 'Most VC Time', value: 'vc' },
                { name: 'Highest Invites', value: 'invites' }
              ]
            }`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('src/commands/giveaway.js', code);
