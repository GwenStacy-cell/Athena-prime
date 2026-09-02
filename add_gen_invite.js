import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

// Change the global DM block to allow 'gen_invite_'
js = js.replace(/async execute\(interaction\) \{\n  if \(\!interaction\.guild\) return;/,
  "async execute(interaction) {\n  if (!interaction.guild && !(interaction.isButton() && interaction.customId.startsWith('gen_invite_'))) return;");

// Add the handler for gen_invite_ inside the execute function, right before handleSecurityInteractions
js = js.replace(/await handleSecurityInteractions\(interaction, guild\);\n    \}/, 
`      if (interaction.isButton() && interaction.customId.startsWith('gen_invite_')) {
        const targetGuildId = interaction.customId.split('_')[2];
        const targetGuild = interaction.client.guilds.cache.get(targetGuildId);
        if (!targetGuild) {
          return interaction.reply({ content: 'I am no longer in that server.', ephemeral: true });
        }
        
        // Find a suitable channel to create an invite
        const channel = targetGuild.channels.cache.find(c => c.type === 0 && c.permissionsFor(targetGuild.members.me).has('CreateInstantInvite'));
        if (!channel) {
          return interaction.reply({ content: 'I do not have permission to create invites in that server, or there are no text channels.', ephemeral: true });
        }
        
        try {
          const invite = await channel.createInvite({ maxAge: 86400, maxUses: 1 });
          return interaction.reply({ content: \`Here is your invite for **\${targetGuild.name}**: \${invite.url}\`, ephemeral: true });
        } catch (err) {
          console.error(err);
          return interaction.reply({ content: 'Failed to create invite.', ephemeral: true });
        }
      }

      await handleSecurityInteractions(interaction, guild);
    }`);

fs.writeFileSync("src/events/interactionCreate.js", js);
