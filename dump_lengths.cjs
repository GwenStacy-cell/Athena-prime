const fs = require('fs');
const files = fs.readdirSync('src/commands').filter(f => f.endsWith('.js') && f !== 'loader.js');

for (const file of files) {
  const content = fs.readFileSync('src/commands/' + file, 'utf8');
  // Simple check for description fields that are > 100 characters anywhere.
  // We'll just look for description: '...' or description: "..." or description: `...`
  const regex = /description:\s*(['"`])([\s\S]*?)\1/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match[2].length > 100) {
      console.log(`[${file}] Length: ${match[2].length} | Desc: ${match[2].replace(/\n/g, '\\n')}`);
    }
  }
}
console.log('Done scanning.');
