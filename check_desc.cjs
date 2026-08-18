const fs = require('fs');
const files = fs.readdirSync('src/commands').filter(f => f.endsWith('.js'));
let found = false;
for (const file of files) {
  const content = fs.readFileSync('src/commands/' + file, 'utf8');
  // Match both single and double quotes, and backticks.
  const matches = [...content.matchAll(/description:\s*(['"`])([\s\S]*?)\1/g)];
  for (const match of matches) {
    if (match[2].length > 100) {
      console.log('Length: ' + match[2].length + ' File: ' + file);
      console.log('Description: ' + match[2]);
      found = true;
    }
  }
}
if (!found) console.log('No descriptions > 100 chars found');
