import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

js = js.replace(
  /const db = \(await import\("\.\.\/database\.js"\)\)\.default;\s*db\.updateGuildConfig\(guild\.id, \{ securityEnabled: true, antiNukeEnabled: true \}\);/g,
  `const db = (await import("../database.js")).default;\n      const config = db.getGuildConfig(guild.id);\n      const modules = config.antinukeModules || {};\n      for (const key in modules) {\n        modules[key] = true;\n      }\n      db.updateGuildConfig(guild.id, {\n        securityEnabled: true,\n        antiNukeEnabled: true,\n        antiInviteEnabled: true,\n        antiSpamMentionEnabled: true,\n        antiLinkEnabled: true,\n        antiFloodEnabled: true,\n        wordFilterEnabled: true,\n        antinukeModules: modules\n      });`
);

fs.writeFileSync("src/commands/security.js", js);
