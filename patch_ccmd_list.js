import fs from "fs";
let js = fs.readFileSync("src/commands/ccmd.js", "utf8");

const target = `          const fields = keys.map(k => ({ name: \`!\${k}\`, value: \`Executes \\\`!\${ccmds[k]}\\\`\`, inline: true }));
          return message.reply({ components: [cv2.buildContainer('Custom Command Shortcuts', 'Configured aliases for this server:', fields)], flags: 16384 });`;

const replace = `          const fields = keys.map(k => ({ name: \`!\${k}\`, value: \`Executes \\\`!\${ccmds[k]}\\\`\`, inline: true }));
          return message.reply(cv2.info('Custom Command Shortcuts', 'Configured aliases for this server:', fields));`;

js = js.replace(target, replace);
fs.writeFileSync("src/commands/ccmd.js", js);
