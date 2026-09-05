import fs from "fs";
let js = fs.readFileSync("src/utils/antinuke.js", "utf8");

js = js.replace(
  /if \(!eventType\) return;\s*recentBans\.set\(\`\$\{guild\.id\}:\$\{executor\.id\}\`, Date\.now\(\)\);/g,
  `if (!eventType) return;\n\n    if (config.learnModeEnabled) {\n      if (!db.cache.nukeSignatures) db.cache.nukeSignatures = [];\n      db.cache.nukeSignatures.push({\n        guildId: guild.id,\n        executorId: executor.id,\n        action: action,\n        eventType: eventType,\n        timestamp: Date.now()\n      });\n      db.save();\n      console.log(\`[ML Engine] Recorded signature: \${eventType} by \${executor.id}\`);\n    }\n\n    recentBans.set(\`\${guild.id}:\${executor.id}\`, Date.now());`
);

fs.writeFileSync("src/utils/antinuke.js", js);
