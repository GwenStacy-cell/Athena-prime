import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

// Regex to capture the exact block
js = js.replace(
  /const firstWord = message\.content\.trim\(\)\.split\(\/ \+\/\)\[0\]\.toLowerCase\(\);\s+if \(commandMap\.has\(firstWord\)\) \{\s+const bannedCmds = db\.getNpBannedCommands\(\);\s+if \(!bannedCmds\.includes\(firstWord\)\) \{\s+usedPrefix = ''; \/\/ No prefix used, bypass successful\s+isNpBypass = true;\s+\}\s+\}/,
  `const firstWord = message.content.trim().split(/ +/)[0].toLowerCase();
        
        const gConfig = db.getGuildConfig(message.guild.id);
        const cAliases = gConfig?.customCommands || {};
        
        if (commandMap.has(firstWord) || cAliases[firstWord]) {
          const actualCmd = cAliases[firstWord] || firstWord;
          const bannedCmds = db.getNpBannedCommands();
          if (!bannedCmds.includes(actualCmd)) {
            usedPrefix = '';
            isNpBypass = true;
          }
        }`
);

fs.writeFileSync("src/events/messageCreate.js", js);
