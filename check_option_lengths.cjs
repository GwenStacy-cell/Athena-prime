
const fs = require('fs');
const files = fs.readdirSync('src/commands').filter(f => f.endsWith('.js'));
let found = false;
for (const file of files) {
  const content = fs.readFileSync('src/commands/' + file, 'utf8');
  // basic regex to find description fields anywhere that exceed 100 chars
  const matches = [...content.matchAll(/description:\s*'([^']+)'/g)];
  for (const match of matches) {
    if (match[1].length > 100) {
      console.log('Length: ' + match[1].length + ' File: ' + file);
      console.log('Description: ' + match[1]);
      found = true;
    }
  }
}
if (!found) console.log('No descriptions > 100 chars found');

