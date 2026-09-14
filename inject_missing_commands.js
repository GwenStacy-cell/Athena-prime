const addCmds = {
  utilities: ['`!qrcode text|url` - Generate a QR code `[public]`', '`/app` - Application system `[public]`', '`!learn` - Teach bot a new command `[admin]`', '`!botstats` - Advanced bot info `[public]`', '`!ytstats` - YouTube Stats VC `[admin]`'],
  voice: ['`!botvoice` - Force bot to join/stay in VC `[admin]`', '`!vcdrag / !vcdragstop` - Drag users to your VC `[extra owners]`', '`!jtcsetup / !secondaryjtc / !jtcdisable` - Advanced JTC `[extra owners]`'],
  moderation: ['`!ignorechan / !ignorecat` - Blacklist commands in channel/category `[admin]`', '`!enuke` - Delete all emojis `[extra owners]`', '`!givemerole / !takemyrole` - Self role assign `[public]`', '`!cleanbadroles` - Wipe unused roles `[extra owners]`', '`!spampermit / !spamrevoke` - Manage anti-spam bypass `[extra owners]`', '`!adel / !radel` - Auto-delete all messages from user `[extra owners]`', '`!fck` - Send direct Athena warning DM `[server owner]`'],
  tracking: ['`!youtube` - Setup YouTube upload notifications `[extra owners]`', '`!syncinvites` - Retroactively sync invite data `[extra owners]`', '`!setdeletelog` - Set deleted message log channel `[extra owners]`'],
  config: ['`!rrsetup` - Setup Reaction Roles `[extra owners]`'],
  stats: ['`!serverstats` - Detailed server stats graphic `[public]`', '`!invitelb / !chatlb / !voicelb` - Top inviters, chatters, voice users `[public]`'],
  tickets: ['`!ticketpanel` - Launch interactive ticket panel manager `[extra owners]`', '`!ticket` - Manage the ticket system `[public]`'],
  messaging: []
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
console.log("Injected additional missing commands cleanly!");
