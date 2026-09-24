const fs = require('fs');
let code = fs.readFileSync('src/commands/security.js', 'utf8');

code = code.replace(
  'h.user.globalName || user.username',
  'h.user.globalName || h.user.username'
);

code = code.replace(
  'b.user.globalName || user.username',
  'b.user.globalName || b.user.username'
);

code = code.replace(
  'h.member.user.globalName || user.username',
  'h.member.user.globalName || h.member.user.username'
);

code = code.replace(
  'b.user.globalName || user.username',
  'b.user.globalName || b.user.username'
);

code = code.replace(
  'b.user.globalName || user.username.substring(0, 100)',
  'b.user.globalName || b.user.username.substring(0, 100)'
);

fs.writeFileSync('src/commands/security.js', code);
console.log('Fixed all 5 undefined user references!');
