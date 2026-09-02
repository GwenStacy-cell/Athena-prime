import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");
js = js.replace(/await handleSecurityInteractions\(interaction, guild\);/, 
`if (interaction.isButton() && interaction.customId.startsWith('gen_invite_')) {
        const targetGuildId = interaction.customId.split('_')[2];
        const targetGuild = interaction.client.guilds.cache.get(targetGuildId);
        if (!targetGuild) {
          return interaction.reply({ content: 'I am no longer in that server.', flags: 64 });
        }
        
        // Find a suitable channel to create an invite
        const channel = targetGuild.channels.cache.find(c => c.type === 0 && c.permissionsFor(targetGuild.members.me).has('CreateInstantInvite'));
        if (!channel) {
          return interaction.reply({ content: 'I do not have permission to create invites in that server, or there are no text channels.', flags: 64 });
        }
        
        try {
          const invite = await channel.createInvite({ maxAge: 86400, maxUses: 1 });
          return interaction.reply({ content: \`Here is your invite for **\${targetGuild.name}**: \${invite.url}\`, flags: 64 });
        } catch (err) {
          console.error(err);
          return interaction.reply({ content: 'Failed to create invite.', flags: 64 });
        }
      }

      await handleSecurityInteractions(interaction, guild);`);
fs.writeFileSync("src/events/interactionCreate.js", js);
