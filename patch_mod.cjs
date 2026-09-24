const fs = require('fs');
let lines = fs.readFileSync('src/commands/moderation.js', 'utf8').split('\n');

for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('/* DELETED COLOR KEY */')) {
    lines[i] = '';
    if (lines[i-1] && lines[i-1].includes('/*')) lines[i-1] = lines[i-1].replace('/*', '');
    if (lines[i+1] && lines[i+1].includes('*/')) lines[i+1] = lines[i+1].replace('*/', '');
  }
}

fs.writeFileSync('src/commands/moderation.js', lines.join('\n'));
console.log('Fixed syntax error in moderation.js with loops!');
