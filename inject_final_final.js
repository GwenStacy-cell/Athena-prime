const addCmds = {
  utilities: [
    '`!stealemoji` - Steal emojis from this server and copy them to another `[bot owner]`'
  ],
  moderation: [
    '`!sethomevc @user / !unsethomevc` - Lock a user to a specific VC `[extra owners]`',
    '`!spamlist` - List all permitted spam users `[extra owners]`'
  ],
  voice: [
    '`!vcdraglist` - View all currently active VC drag sessions `[extra owners]`'
  ],
  welcome: [
    '`!leave` - Open the Leave Message Manager `[extra owners]`',
    '`!autorole-config` - Add or remove an autorole for new members `[extra owners]`'
  ],
  tracking: [
    '`!invitedisable` - Disable invite tracking for the server `[extra owners]`'
  ],
  giveaways: [
    '`!testbirthday` - Send a test birthday announcement `[extra owners]`'
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

fs.writeFileSync("src/commands/utility.js", js);
console.log("Injected the absolute final remaining commands!");
