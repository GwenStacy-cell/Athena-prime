import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const oldPrefix = `      async executePrefix(message) {
        let reply;
        try {
          const components = buildHelpContainer(message.client, message.guild?.id, 'home');
          reply = await message.reply({ components: [components], flags: MessageFlags.IsComponentsV2 });
        } catch (e) {
          return message.channel.send({ content: \`**DEBUG ERROR:** \\\`\${e.message}\\\`\` }).catch(() => null);
        }`;

const newPrefix = `      async executePrefix(message, args) {
        let reply;
        try {
          if (args && args.length > 0) {
              const cmdName = args[0].toLowerCase();
              const { default: commandMap } = await import('./loader.js');
              const targetCmd = commandMap.get(cmdName);
              
              if (!targetCmd) {
                  return message.reply(cv2.warn("Command Not Found", \`No command found matching \\\`\${cmdName}\\\`.\`));
              }
              
              const { TextDisplayBuilder, ContainerBuilder, MessageFlags } = await import('discord.js');
              
              let permsText = "Public / Everyone";
              if (targetCmd.permissions && targetCmd.permissions.length > 0) {
                  if (targetCmd.permissions.includes(8n)) permsText = "Administrator";
                  else if (targetCmd.permissions.includes(32n)) permsText = "Manage Server";
                  else if (targetCmd.permissions.includes(1099511627776n)) permsText = "Moderate Members";
                  else permsText = "Elevated Permissions";
              }
              
              let catStr = targetCmd.category ? targetCmd.category.charAt(0).toUpperCase() + targetCmd.category.slice(1) : "General";
              if (catStr === "Security") catStr = "@Bot Commands (Direct @Bot Mention Commands)";
              
              const db = (await import('../database.js')).default;
              const config = db.getGuildConfig(message.guild.id);
              const prefix = config?.prefix || '!';

              const display1 = new TextDisplayBuilder().setContent(\`# Command Name: \\\`\${targetCmd.name}\\\`\\n\\n> -# **Command usage:** \\\`\${prefix}\${targetCmd.name}\\\`\\n> -# **Command Permissions:** \\\`\${permsText}\\\`\`);
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
        }`;

if (js.includes(oldPrefix)) {
    js = js.replace(oldPrefix, newPrefix);
    fs.writeFileSync("src/commands/utility.js", js);
    console.log("Success!");
} else {
    console.log("Could not find block to replace.");
}
