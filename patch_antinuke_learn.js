import fs from "fs";
let js = fs.readFileSync("src/utils/antinuke.js", "utf8");

const target = `  if (!eventType) return;
  
    recentBans.set(\`\${guild.id}:\${executor.id}\`, Date.now());`;

const replace = `  if (!eventType) return;
  
    if (config.learnModeEnabled) {
      if (!db.cache.nukeSignatures) db.cache.nukeSignatures = [];
      db.cache.nukeSignatures.push({
        guildId: guild.id,
        executorId: executor.id,
        action: action,
        eventType: eventType,
        timestamp: Date.now()
      });
      db.save();
      console.log(\`[ML Engine] Recorded signature: \${eventType} by \${executor.id}\`);
      return; // Suppress punishment during training phase
    }
  
    recentBans.set(\`\${guild.id}:\${executor.id}\`, Date.now());`;

js = js.replace(target, replace);
fs.writeFileSync("src/utils/antinuke.js", js);
