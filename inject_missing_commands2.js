const addCmds = {
  utilities: [
    '`!backup create` - Create a full server backup (channels, roles, settings) `[extra owners]`',
    '`!backup load <id>` - Restore a server backup instantly `[extra owners]`',
    '`!backup list` - List all server backups `[extra owners]`',
    '`!backup delete <id>` - Delete a backup `[extra owners]`',
    '`!steal <emoji>` - Steal one or more custom emojis into this server `[extra owners]`'
  ],
  tickets: [
    "**Ticket System Setup Guide**",
    "`/ticket setup` - Instantly deploy the configured ticket panel to your current channel `[extra owners]`",
    "**Panel Builder Options:**",
    "- Add Dropdown Options (e.g. Support, Billing)",
    "- Configure Welcome Messages per option",
    "- Restrict Ticket Closing to specific Roles",
    "- Add Panel Banners & Thumbnails",
    "- Customize Panel Titles & Embeds"
  ],
  config: [
    "`!setguildavatar` - Set the bot's custom server-specific avatar `[extra owners]`",
    "`!setguildbanner` - Set the bot's custom server-specific banner `[extra owners]`",
    "`!setstatschannel` - Set a dedicated channel for stats commands `[extra owners]`"
  ],
  stats: [
    '`!si` / `!serverinfo` - Displays advanced CV2 Server Information `[public]`'
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
console.log("Injected final missing commands cleanly!");
