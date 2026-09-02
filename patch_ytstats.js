import fs from "fs";
let js = fs.readFileSync("src/commands/ytstats.js", "utf8");

const oldLogic = `    // Ensure handle starts with @
    if (!ytHandle.startsWith('@') && !ytHandle.startsWith('UC')) {
      ytHandle = '@' + ytHandle;
    }
    
    const config = db.getGuildConfig(interaction.guild.id);`;

const newLogic = `    // Extract handle if they pasted a full URL
    if (ytHandle.includes('youtube.com/')) {
      const parts = ytHandle.split('youtube.com/');
      ytHandle = parts[1];
    }
    // Remove any trailing slashes or queries
    ytHandle = ytHandle.split('?')[0].replace(/\\/$/, '');
    
    // Ensure handle starts with @
    if (!ytHandle.startsWith('@') && !ytHandle.startsWith('UC')) {
      ytHandle = '@' + ytHandle;
    }
    
    const config = db.getGuildConfig(interaction.guild.id);`;

js = js.replace(oldLogic, newLogic);
fs.writeFileSync("src/commands/ytstats.js", js);
