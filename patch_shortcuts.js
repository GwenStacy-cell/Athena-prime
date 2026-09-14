import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

const oldStr = `
    // Find command by name (loader.js populates aliases directly in commandMap)
    const cmd = commandMap.get(commandName);

    // --- COMMAND & CHANNEL IGNORE SYSTEM ---`;

const newStr = `
    // Find command by name (loader.js populates aliases directly in commandMap)
    let cmd = commandMap.get(commandName);

    // --- SHORTCUTS TOGGLE SYSTEM ---
    if (cmd && config.shortcutsEnabled === false) {
      if (cmd.name !== commandName && commandName !== 'sc' && commandName !== 'shortcuts') {
        cmd = undefined; // Block the alias from running
      }
    }

    // --- COMMAND & CHANNEL IGNORE SYSTEM ---`;

js = js.replace(oldStr.trim(), newStr.trim());
fs.writeFileSync("src/events/messageCreate.js", js);
console.log("Injected shortcut interceptor!");
