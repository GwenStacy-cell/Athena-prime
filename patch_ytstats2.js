import fs from "fs";
let js = fs.readFileSync("src/commands/ytstats.js", "utf8");

const oldLogic = `    // Extract handle if they pasted a full URL
    if (ytHandle.includes('youtube.com/')) {
      const parts = ytHandle.split('youtube.com/');
      ytHandle = parts[1];
    }
    // Remove any trailing slashes or queries
    ytHandle = ytHandle.split('?')[0].replace(/\\/$/, '');
    
    // Ensure handle starts with @
    if (!ytHandle.startsWith('@') && !ytHandle.startsWith('UC')) {
      ytHandle = '@' + ytHandle;
    }`;

const newLogic = `    // Extract handle if they pasted a full URL
    if (ytHandle.includes('youtube.com/')) {
      const parts = ytHandle.split('youtube.com/');
      ytHandle = parts[1];
    }
    // Remove any trailing slashes, queries, or leading slashes
    ytHandle = ytHandle.split('?')[0].replace(/[\\/]/g, '').trim();
    
    // Ensure handle starts with @ if it's not a UC channel ID
    if (!ytHandle.startsWith('@') && !ytHandle.startsWith('UC')) {
      ytHandle = '@' + ytHandle;
    }`;

js = js.replace(oldLogic, newLogic);
fs.writeFileSync("src/commands/ytstats.js", js);
