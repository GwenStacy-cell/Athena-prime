import fs from "fs";

// Update security.js
let sec = fs.readFileSync("src/commands/security.js", "utf8");

const oldSecStr = `    } else {
      for (const rId of bypassedRolesKeys) {
        if (bypasses[rId] && bypasses[rId].length > 0) {
          bypassText += \`-# **| <@&\${rId}> Bypasses:** \${bypasses[rId].join(', ')}\\n\`;
        }
      }
    }`;

const newSecStr = `    } else {
      for (const rId of bypassedRolesKeys) {
        if (bypasses[rId] && bypasses[rId].length > 0) {
          const displayStr = bypasses[rId].length >= 10 ? 'All Automoderation Events' : bypasses[rId].join(', ');
          bypassText += \`-# **| <@&\${rId}> Bypasses:** \${displayStr}\\n\`;
        }
      }
    }`;

sec = sec.replace(oldSecStr, newSecStr);
fs.writeFileSync("src/commands/security.js", sec);

// Update interactionCreate.js
let intC = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const oldIntCStr = `const filterStr = roleBypasses.length > 0 ? roleBypasses.join(', ') : 'None';`;
const newIntCStr = `const filterStr = roleBypasses.length >= 10 ? 'All Automoderation Events' : (roleBypasses.length > 0 ? roleBypasses.join(', ') : 'None');`;

intC = intC.replace(oldIntCStr, newIntCStr);
fs.writeFileSync("src/events/interactionCreate.js", intC);

