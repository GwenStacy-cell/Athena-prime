import fs from 'fs';
let text = fs.readFileSync('src/commands/shortcuts.js', 'utf8');
text = text.replace('!av or !pfp', '!av, !pfp, or !icon');
fs.writeFileSync('src/commands/shortcuts.js', text);
