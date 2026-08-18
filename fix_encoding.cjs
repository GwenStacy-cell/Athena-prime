
const fs = require('fs');
let code = fs.readFileSync('src/commands/security.js', 'utf8');

// The corrupted character is 'â€�'
// Sometimes it has invisible trailing characters, so let's do a global replace
code = code.split('â€�').join('-');

fs.writeFileSync('src/commands/security.js', code, 'utf8');
console.log('Fixed encoding globally');

