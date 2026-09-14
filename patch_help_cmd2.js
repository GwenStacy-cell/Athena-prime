import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const start = js.indexOf("async executePrefix(message) {");
const end = js.indexOf("const collector = reply.createMessageComponentCollector", start);

const newPrefix = `async executePrefix(message, args) {
        let reply;
        try {
          if (args && args.length > 0) {
              const cmdName = args[0].toLowerCase();
              const { default: commandMap } = await import('./loader.js');
              let targetCmd = commandMap.get(cmdName);
              
              if (!targetCmd) {
                  return message.reply({ content: \`-! \u26A0\uFE0F **Command Not Found:** \` + cmdName });
              }
              
              const { TextDisplayBuilder, MessageFlags } = await import('discord.js');
              
              let permsText = "Public / Everyone";
              if (targetCmd.permissions && targetCmd.permissions.length > 0) {
                  if (targetCmd.permissions.includes(8n)) permsText = "Administrator";
                  else if (targetCmd.permissions.includes(32n)) permsText = "Manage Server";
                  else if (targetCmd.permissions.includes(1099511627776n)) permsText = "Moderate Members";
                  else permsText = "Elevated Permissions";
              }
              
              let catStr = targetCmd.category ? targetCmd.category.charAt(0).toUpperCase() + targetCmd.category.slice(1) : "General";
              if (targetCmd.name === "qr" || targetCmd.name === "fck" || targetCmd.name === "np") {
                  catStr = "@Bot Commands (Direct @Bot Mention Commands)";
              }
              
              const db = (await import('../database.js')).default;
              const config = db.getGuildConfig(message.guild.id);
              const prefix = config?.prefix || '!';
              
              let usageText = \`\${prefix}\${targetCmd.name}\`;
              if (targetCmd.name === "qr" || targetCmd.name === "fck" || targetCmd.name === "np") {
                  usageText = \`@bot \${targetCmd.name}\`;
              }
              
              const display1 = new TextDisplayBuilder().setContent(\`# Command Name: \\\`\${targetCmd.name}\\\`\\n\\n> -# **Command usage:** \\\`\${usageText}\\\`\\n> -# **Command Permissions:** \\\`\${permsText}\\\`\`);
              const display2 = new TextDisplayBuilder().setContent(\`> -# **Command Explain : What Is The Purpose of that command:**\\n> -# \${targetCmd.description || "No description provided."}\`);
              const display3 = new TextDisplayBuilder().setContent(\`-# **Category:** \${catStr}\`);
              
              const container = {
                  type: 17,
                  components: [
                      display1,
                      { type: 14, divider: true },
                      display2,
                      { type: 14, divider: true },
                      display3
                  ]
              };
              
              return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
          }

          const components = buildHelpContainer(message.client, message.guild?.id, 'home');
          reply = await message.reply({ components: [components], flags: MessageFlags.IsComponentsV2 });
        } catch (e) {
          return message.channel.send({ content: \`**DEBUG ERROR:** \\\`\${e.message}\\\`\` }).catch(() => null);
        }
        `;

js = js.substring(0, start) + newPrefix + js.substring(end);
fs.writeFileSync("src/commands/utility.js", js);
console.log("Success!");
