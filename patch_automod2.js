import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

const oldStr = `
      name: 'automod',
        aliases: ['automoderator', 'antilink'],
        description: 'Opens the interactive Automated Moderation & Security Dashboard (Admin only).',
      category: 'security',
      permissions: [PermissionFlagsBits.Administrator],
      options: [],
      async executePrefix(message) {
        const panel = await getAutoModPanel(message.guild);
        await message.reply(panel);
      },`;

const newStr = `
      name: 'automod',
        aliases: ['automoderator', 'antilink'],
        description: 'Opens the interactive Automated Moderation & Security Dashboard (Admin only).',
      category: 'security',
      permissions: [PermissionFlagsBits.Administrator],
      options: [],
      async executePrefix(message, args) {
        if (args && args[0] && args[0].toLowerCase() === 'advanced') {
          const panel = await getAdvancedConfigPanel(message.guild);
          return message.reply(panel);
        }
        const panel = await getAutoModPanel(message.guild);
        await message.reply(panel);
      },`;

js = js.replace(oldStr.trim(), newStr.trim());
fs.writeFileSync("src/commands/security.js", js);
console.log("Replaced successfully!");
