
const fs = require('fs');
const files = fs.readdirSync('src/commands').filter(f => f.endsWith('.js'));
let found = false;
for (const file of files) {
  const content = fs.readFileSync('src/commands/' + file, 'utf8');
  const matches = [...content.matchAll(/name:\s*'([^']+)',[\s\S]*?description:\s*'([^']+)'/g)];
  for (const match of matches) {
    if (match[2].length > 100) {
      console.log('Command: ' + match[1] + ' Length: ' + match[2].length + ' File: ' + file);
      console.log('Description: ' + match[2]);
      found = true;
    }
  }
}
if (!found) console.log('No descriptions > 100 chars found in commands');

