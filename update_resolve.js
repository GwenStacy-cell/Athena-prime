import fs from "fs";
let js = fs.readFileSync("src/commands/welcome.js", "utf8");
js = js.replace(/function resolve\(text, member\) \{/, "function resolve(text, member, cfg = {}) {");
js = js.replace(/return text\s*\.replace\(\/\{user\}\/gi, `<@\$\{member\.id\}>`\)\s*\.replace\(\/\{usermention\}\/gi, `<@\$\{member\.id\}>`\)/, 
`  let userFormat = \`<@\${member.id}>\`;
  if (cfg.nameFormat === 'user_link') {
    userFormat = \`[\${member.user.username}](https://discord.com/users/\${member.id})\`;
  } else if (cfg.nameFormat === 'nick_link') {
    userFormat = \`[\${member.displayName}](https://discord.com/users/\${member.id})\`;
  }
  return text
    .replace(/{user}/gi, userFormat)
    .replace(/{usermention}/gi, userFormat)`);

// Update all resolve calls
js = js.replace(/resolve\(cfg\.(\w+), member\)/g, "resolve(cfg.$1, member, cfg)");
fs.writeFileSync("src/commands/welcome.js", js);
