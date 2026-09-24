const fs = require('fs');
let code = fs.readFileSync('src/commands/security.js', 'utf8');

code = code.replace(
  'return message.reply({ content: "?? **Critical Security Action Blocked** ??\\nAn email has been sent to your registered Gmail address. You must verify it to authorize this action.", components: [row] });',
  'return message.reply({ content: "?? **Critical Security Action Blocked** ??\\nAn email has been sent to your registered Gmail address. You must verify it to authorize this action.", components: [row] }).catch(() => null);'
);

code = code.replace(
  'await message.reply(result);',
  'await message.reply(result).catch(() => null);'
);

fs.writeFileSync('src/commands/security.js', code);
