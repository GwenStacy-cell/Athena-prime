import fs from "fs";
let js = fs.readFileSync("src/commands/vcpanel.js", "utf8");

// Remove the old permission check
js = js.replace(/const botOwnerId = process\.env\.OWNER_ID;\s*if\s*\(message\.author\.id !== message\.guild\.ownerId && message\.author\.id !== botOwnerId\)\s*\{\s*return;\s*\/\/ Ignore completely if not authorized\s*\}/g,
"if (message.author.id !== message.guild.ownerId && !isBotOwnerSync(message.author.id) && !isExtraOwner(message.guild.id, message.author.id)) {\n        return message.reply({ content: 'Only the Server Owner, Bot Owner, and Extra Owners can use this panel.' }).catch(()=>{});\n      }");

fs.writeFileSync("src/commands/vcpanel.js", js);
console.log("Patched vcpanel.js successfully!");
