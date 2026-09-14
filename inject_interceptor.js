import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

const regex = /\/\/ Find command by name \(loader\.js populates aliases directly in commandMap\)\s+const cmd = commandMap\.get\(commandName\);\s+\/\/ --- COMMAND & CHANNEL IGNORE SYSTEM ---/;

const newStr = `// Find command by name (loader.js populates aliases directly in commandMap)
    let cmd = commandMap.get(commandName);

    // --- SHORTCUTS TOGGLE SYSTEM ---
    if (cmd && config.shortcutsEnabled === false) {
      if (cmd.name !== commandName && commandName !== 'sc' && commandName !== 'shortcuts') {
        cmd = undefined; // Block the alias from running
      }
    }

    // --- COMMAND & CHANNEL IGNORE SYSTEM ---`;

if (regex.test(js)) {
    js = js.replace(regex, newStr);
    fs.writeFileSync("src/events/messageCreate.js", js);
    console.log("Interceptor successfully injected!");
} else {
    console.log("Regex didn't match anything!");
}
