const fs = require('fs');
let code = fs.readFileSync('src/commands/utility.js', 'utf8');
code = code.replace(
  ', "`!enuke` - Opens the Enuke Manager (server wipe sequencer) `[bot owner]`"',
  ''
);
fs.writeFileSync('src/commands/utility.js', code);
console.log('Removed enuke!');
