
const fs = require('fs');
let code = fs.readFileSync('src/commands/security.js', 'utf8');

// Replace standard em dash
code = code.replace(/\u2014/g, '-');
// Replace corrupted em dash
code = code.replace(/â€�/g, '-'); 
// Just replace using a regex for the exact string 'â€�' by its unicode escapes
code = code.replace(/\xEF\xBF\xBD/g, '-'); // replacement char
code = code.replace(/\u00C3\u00A2\u00E2\u201A\u00AC\u00E2\u20AC\u0153/g, '-');

// Even better: just match the string from the user's screenshot
code = code.replace(/â€�/g, '-');
fs.writeFileSync('src/commands/security.js', code, 'utf8');

