import fs from "fs";
let si = fs.readFileSync("src/commands/si.js", "utf8");

// Fix emojis
si = si.replace(
    /let emojiSample = emojis\.map\(e => e\.toString\(\)\)\.join\(' '\);\n\s*if \(emojiSample\.length > 300\) emojiSample = emojiSample\.substring\(0, 300\) \+ '\.\.\.';/,
    `let emojiArr = emojis.map(e => e.toString());\n        let emojiSample = emojiArr.length > 25 ? emojiArr.slice(0, 25).join(' ') + ' ...' : emojiArr.join(' ');`
);

// Fix roles
si = si.replace(
    /const roles = guild\.roles\.cache\.sort\(\(a, b\) => b\.position - a\.position\)\n\s*\.filter\(r => r\.id !== guild\.id\)\n\s*\.map\(r => r\.toString\(\)\)\n\s*\.join\(', '\);\n\s*const roleSample = roles\.length > 600 \? roles\.substring\(0, 600\) \+ '\.\.\.' : roles;/,
    `const roleArr = guild.roles.cache.sort((a, b) => b.position - a.position).filter(r => r.id !== guild.id).map(r => r.toString());\n        const roleSample = roleArr.length > 30 ? roleArr.slice(0, 30).join(', ') + ' ...' : roleArr.join(', ');`
);

// Fix Boosts panel to include Booster Role
si = si.replace(
    /\`\*\*Boost Level :\*\* Level \$\{boostLevel\}\\n\*\*Boost count :\*\* \$\{boostCount\}\\n\*\*Boosters :\*\* 0\` \/\/ Discord\.js v14 doesn't track boosters directly without fetching members/,
    `\`**Boost Level :** Level \${boostLevel}\\n**Boost count :** \${boostCount}\\n**Boosters :** 0\\n**Booster Role :** \${guild.roles.premiumSubscriberRole ? guild.roles.premiumSubscriberRole.toString() : 'None'}\``
);

fs.writeFileSync("src/commands/si.js", si);
