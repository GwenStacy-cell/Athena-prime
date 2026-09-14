import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

js = js.replace(/async executePrefix\(message\) \{\s+const panel \= await getAutoModPanel\(message\.guild\);\s+await message\.reply\(panel\);\s+\}/g, `async executePrefix(message, args) {
        if (args && args[0] && args[0].toLowerCase() === 'advanced') {
          const panel = await getAdvancedConfigPanel(message.guild);
          return message.reply(panel);
        }
        const panel = await getAutoModPanel(message.guild);
        await message.reply(panel);
      }`);

fs.writeFileSync("src/commands/security.js", js);
console.log("Regex replace done");
