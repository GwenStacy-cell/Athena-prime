import fs from "fs";
let js = fs.readFileSync("src/events/ready.js", "utf8");

js = js.replace(
  /\/\/ Unbypassable Role\s*ensureUnbypassableRole\(guild\)\.catch\(\(\) => null\);/g,
  `// Unbypassable Role\n      const cfg = db.getGuildConfig(guild.id);\n      if (cfg && (cfg.securityEnabled || cfg.antiNukeEnabled)) {\n        ensureUnbypassableRole(guild).catch(() => null);\n      }`
);

fs.writeFileSync("src/events/ready.js", js);
