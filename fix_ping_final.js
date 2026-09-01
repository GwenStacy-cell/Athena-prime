import fs from "fs";
let code = fs.readFileSync("src/commands/utility.js", "utf8");

// Initial replies
const oldPrefixInit = "const sent = await message.reply({ content: 'Calculating ping...' });";
const newPrefixInit = `const { MessageFlags } = await import('discord.js');
      const sent = await message.reply({ 
        components: [{ type: 17, components: [{ type: 10, content: '-# **Calculating ping...**' }] }],
        flags: MessageFlags.IsComponentsV2 
      });`;
code = code.replace(oldPrefixInit, newPrefixInit);

const oldSlashInit = "await interaction.reply({ content: 'Calculating ping...' });";
const newSlashInit = `const { MessageFlags } = await import('discord.js');
      await interaction.reply({ 
        components: [{ type: 17, components: [{ type: 10, content: '-# **Calculating ping...**' }] }],
        flags: MessageFlags.IsComponentsV2 
      });`;
code = code.replace(oldSlashInit, newSlashInit);

// Embed payloads
const oldPrefixPayload = `const e = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(\`| <:dark4luvontop:1533860081916182721> \${message.author} **\${apiMs}ms | WS : \${wsMs}ms | DB : \${dbMs}ms | Redis : SET : \${rSet}ms GET : \${rGet}ms DEL : \${rDel}ms**\`)
        .setImage('attachment://ping_graph.png');

      await sent.edit({ content: '', embeds: [e], files: [attachment] });`;
      
const newPrefixPayload = `const comps = [
        { type: 10, content: \`-# **| <:dark4luvontop:1533860081916182721> \${message.author} \${apiMs}ms | WS : \${wsMs}ms | DB : \${dbMs}ms | Redis : SET : \${rSet}ms GET : \${rGet}ms DEL : \${rDel}ms**\` },
        { type: 12, items: [{ media: { url: 'attachment://ping_graph.png' } }] }
      ];

      await sent.edit({ content: '', components: [{ type: 17, components: comps }], files: [attachment], embeds: [] });`;
code = code.replace(oldPrefixPayload, newPrefixPayload);

const oldSlashPayload = `const e = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(\`| <:dark4luvontop:1533860081916182721> \${interaction.user} **\${apiMs}ms | WS : \${wsMs}ms | DB : \${dbMs}ms | Redis : SET : \${rSet}ms GET : \${rGet}ms DEL : \${rDel}ms**\`)
        .setImage('attachment://ping_graph.png');

      await interaction.editReply({ content: '', embeds: [e], files: [attachment] });`;

const newSlashPayload = `const comps = [
        { type: 10, content: \`-# **| <:dark4luvontop:1533860081916182721> \${interaction.user} \${apiMs}ms | WS : \${wsMs}ms | DB : \${dbMs}ms | Redis : SET : \${rSet}ms GET : \${rGet}ms DEL : \${rDel}ms**\` },
        { type: 12, items: [{ media: { url: 'attachment://ping_graph.png' } }] }
      ];

      await interaction.editReply({ content: '', components: [{ type: 17, components: comps }], files: [attachment], embeds: [] });`;
code = code.replace(oldSlashPayload, newSlashPayload);

fs.writeFileSync("src/commands/utility.js", code);
