const fs = require('fs');
let code = fs.readFileSync('src/commands/moderation.js', 'utf8');

const target1 = "color: roleColor || undefined,";

code = code.replace(
  target1,
  "/* DELETED COLOR KEY */"
);

const target2 = "const role = await guild.roles.create({ name,";

code = code.replace(
  target2,
  "const opts = { name, reason: `Created by ${moderator.user.tag}` }; if (roleColor) opts.color = roleColor; const role = await guild.roles.create(opts); /*"
);

const target3 = "reason: `Created by ${moderator.user.tag}` });";

code = code.replace(
  target3,
  "*/"
);

fs.writeFileSync('src/commands/moderation.js', code);
console.log('Replaced via fragments!');
