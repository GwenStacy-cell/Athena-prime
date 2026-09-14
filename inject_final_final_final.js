const addCmds = {
  moderation: [
    '`!unban / !unbanall` - Unban a specific user or mass-unban all users `[extra owners]`',
    '`!unignoreall` - Lift the mass command lock `[admin]`'
  ],
  security: [
    '`!endemergency` - End emergency mode and restore all permissions `[extra owners]`'
  ]
};

import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

for (const [id, cmds] of Object.entries(addCmds)) {
    if (cmds.length === 0) continue;
    
    // Find the module object
    const modRegex = new RegExp(`(\\{\\s*id:\\s*'${id}'.*?commands:\\s*\\[)(.*?)(\\]\\s*\\},?)`, 'g');
    
    js = js.replace(modRegex, (match, prefix, existingCmds, suffix) => {
        let existingArray;
        try {
            existingArray = JSON.parse(`[${existingCmds}]`);
        } catch (e) {
            console.error(`Failed to parse commands for ${id}`);
            return match;
        }
        
        // Merge without duplicates
        for (const cmd of cmds) {
            if (!existingArray.includes(cmd)) {
                existingArray.push(cmd);
            }
        }
        
        return prefix + existingArray.map(c => JSON.stringify(c)).join(', ') + suffix;
    });
}

// Fix !emergency mode / end -> !emergency mode
js = js.replace('`!emergency mode` / `end`', '`!emergency mode`');

fs.writeFileSync("src/commands/utility.js", js);
console.log("Injected unban, unbanall, unignoreall, endemergency!");
