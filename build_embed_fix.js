import fs from "fs";
let js = fs.readFileSync("src/commands/welcome.js", "utf8");
js = js.replace(/name: cfg\.from \? resolve\(cfg\.from, member, cfg\) : resolve\('\{user\}', member, cfg\)\.replace\(\/<@\\d\+>\/g, member\.user\.username\),/,
  "name: (cfg.from ? resolve(cfg.from, member, cfg) : resolve('{user}', member, cfg)).replace(/<@!?\\d+>/g, member.user.username),");
fs.writeFileSync("src/commands/welcome.js", js);
