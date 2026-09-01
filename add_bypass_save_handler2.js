import fs from "fs";
let text = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const replacement = `          } else if (parts[1] === 'reset') {
            targetRoleForBypass = parts[2];
            const bypasses = config.automodBypasses || {};
            bypasses[targetRoleForBypass] = [];
            db.updateGuildConfig(guild.id, { automodBypasses: bypasses });
            updated = true;
          } else if (parts[1] === 'save') {
            targetRoleForBypass = parts[2];
            const bypasses = config.automodBypasses || {};
            const roleBypasses = bypasses[targetRoleForBypass] || [];
            const filterStr = roleBypasses.length > 0 ? roleBypasses.join(', ') : 'None';
            
            await interaction.message.delete().catch(() => null);
            
            const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = await import('discord.js');
            const c = new ContainerBuilder().addTextDisplayComponents(
              new TextDisplayBuilder().setContent(\`> \${interaction.user} Has Bypass " \${filterStr} " For <@&\${targetRoleForBypass}>\`)
            );
            return interaction.channel.send({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
          } else {`;

text = text.replace(
    `          } else if (parts[1] === 'reset') {\n            targetRoleForBypass = parts[2];\n            const bypasses = config.automodBypasses || {};\n            bypasses[targetRoleForBypass] = [];\n            db.updateGuildConfig(guild.id, { automodBypasses: bypasses });\n            updated = true;\n          } else {`,
    replacement
);

fs.writeFileSync("src/events/interactionCreate.js", text);
