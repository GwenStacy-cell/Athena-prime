import fs from "fs";
let code = fs.readFileSync("src/commands/utility.js", "utf8");

const oldPrefix = `      async executePrefix(message) {
        const { EmbedBuilder, AttachmentBuilder } = await import('discord.js');
        const { generatePingGraph } = await import('../utils/graph.js');
        const cfg = db.getGuildConfig(message.guild?.id || '0');
        const accentHex = cfg?.accentColor || '#00e5ff';
        const accentInt = parseInt(accentHex.replace('#', ''), 16);
  
        const sent = await message.reply({ content: 'Calculating ping...' });
        const apiMs = sent.createdTimestamp - message.createdTimestamp;
        const wsMs  = Math.round(message.client.ws.ping);
  
        const dbStart = Date.now();
        db.getGuildConfig(message.guild?.id || '0');
        const dbMs = Date.now() - dbStart;
  
        const rSet = Math.floor(Math.random() * 3) + 1;
        const rGet = Math.floor(Math.random() * 2) + 1;
        const rDel = Math.floor(Math.random() * 2) + 1;
  
        const buffer = await generatePingGraph(wsMs, accentHex, message.client.guilds.cache.size);
        const attachment = new AttachmentBuilder(buffer, { name: 'ping_graph.png' });
  
        const e = new EmbedBuilder()
          .setColor(accentInt)
          .setDescription(\`| <:dark4luvontop:1533860081916182721> \${message.author} **\${apiMs}ms | WS : \${wsMs}ms | DB : \${dbMs}ms | Redis : SET : \${rSet}ms GET : \${rGet}ms DEL : \${rDel}ms**\`)
          .setImage('attachment://ping_graph.png');
  
        await sent.edit({ content: '', embeds: [e], files: [attachment] });
      }`;

const newPrefix = `      async executePrefix(message) {
        const { AttachmentBuilder, MessageFlags } = await import('discord.js');
        const { generatePingGraph } = await import('../utils/graph.js');
        const cfg = db.getGuildConfig(message.guild?.id || '0');
        const accentHex = cfg?.accentColor || '#00e5ff';
  
        const sent = await message.reply({ 
          components: [{ type: 17, components: [{ type: 10, content: '-# **Calculating ping...**' }] }],
          flags: MessageFlags.IsComponentsV2 
        });
        const apiMs = sent.createdTimestamp - message.createdTimestamp;
        const wsMs  = Math.round(message.client.ws.ping);
  
        const dbStart = Date.now();
        db.getGuildConfig(message.guild?.id || '0');
        const dbMs = Date.now() - dbStart;
  
        const rSet = Math.floor(Math.random() * 3) + 1;
        const rGet = Math.floor(Math.random() * 2) + 1;
        const rDel = Math.floor(Math.random() * 2) + 1;
  
        const buffer = await generatePingGraph(wsMs, accentHex, message.client.guilds.cache.size);
        const attachment = new AttachmentBuilder(buffer, { name: 'ping_graph.png' });
  
        const comps = [
          { type: 10, content: \`-# **| <:dark4luvontop:1533860081916182721> \${message.author} \${apiMs}ms | WS : \${wsMs}ms | DB : \${dbMs}ms | Redis : SET : \${rSet}ms GET : \${rGet}ms DEL : \${rDel}ms**\` },
          { type: 12, items: [{ media: { url: 'attachment://ping_graph.png' } }] }
        ];

        await sent.edit({ content: '', components: [{ type: 17, components: comps }], files: [attachment] });
      }`;

const oldSlash = `      async executeSlash(interaction) {
        const { EmbedBuilder, AttachmentBuilder } = await import('discord.js');
        const { generatePingGraph } = await import('../utils/graph.js');
        const cfg = db.getGuildConfig(interaction.guild?.id || '0');
        const accentHex = cfg?.accentColor || '#00e5ff';
        const accentInt = parseInt(accentHex.replace('#', ''), 16);
  
        await interaction.reply({ content: 'Calculating ping...' });
        const sent = await interaction.fetchReply();
        const apiMs = sent.createdTimestamp - interaction.createdTimestamp;
        const wsMs  = Math.round(interaction.client.ws.ping);
  
        const dbStart = Date.now();
        db.getGuildConfig(interaction.guild?.id || '0');
        const dbMs = Date.now() - dbStart;
  
        const rSet = Math.floor(Math.random() * 3) + 1;
        const rGet = Math.floor(Math.random() * 2) + 1;
        const rDel = Math.floor(Math.random() * 2) + 1;
  
        const buffer = await generatePingGraph(wsMs, accentHex, interaction.client.guilds.cache.size);
        const attachment = new AttachmentBuilder(buffer, { name: 'ping_graph.png' });
  
        const e = new EmbedBuilder()
          .setColor(accentInt)
          .setDescription(\`| <:dark4luvontop:1533860081916182721> \${interaction.user} **\${apiMs}ms | WS : \${wsMs}ms | DB : \${dbMs}ms | Redis : SET : \${rSet}ms GET : \${rGet}ms DEL : \${rDel}ms**\`)
          .setImage('attachment://ping_graph.png');
  
        await interaction.editReply({ content: '', embeds: [e], files: [attachment] });
      }`;

const newSlash = `      async executeSlash(interaction) {
        const { AttachmentBuilder, MessageFlags } = await import('discord.js');
        const { generatePingGraph } = await import('../utils/graph.js');
        const cfg = db.getGuildConfig(interaction.guild?.id || '0');
        const accentHex = cfg?.accentColor || '#00e5ff';
  
        await interaction.reply({ 
          components: [{ type: 17, components: [{ type: 10, content: '-# **Calculating ping...**' }] }],
          flags: MessageFlags.IsComponentsV2
        });
        const sent = await interaction.fetchReply();
        const apiMs = sent.createdTimestamp - interaction.createdTimestamp;
        const wsMs  = Math.round(interaction.client.ws.ping);
  
        const dbStart = Date.now();
        db.getGuildConfig(interaction.guild?.id || '0');
        const dbMs = Date.now() - dbStart;
  
        const rSet = Math.floor(Math.random() * 3) + 1;
        const rGet = Math.floor(Math.random() * 2) + 1;
        const rDel = Math.floor(Math.random() * 2) + 1;
  
        const buffer = await generatePingGraph(wsMs, accentHex, interaction.client.guilds.cache.size);
        const attachment = new AttachmentBuilder(buffer, { name: 'ping_graph.png' });
  
        const comps = [
          { type: 10, content: \`-# **| <:dark4luvontop:1533860081916182721> \${interaction.user} \${apiMs}ms | WS : \${wsMs}ms | DB : \${dbMs}ms | Redis : SET : \${rSet}ms GET : \${rGet}ms DEL : \${rDel}ms**\` },
          { type: 12, items: [{ media: { url: 'attachment://ping_graph.png' } }] }
        ];

        await interaction.editReply({ content: '', components: [{ type: 17, components: comps }], files: [attachment] });
      }`;

code = code.replace(oldPrefix, newPrefix);
code = code.replace(oldSlash, newSlash);

fs.writeFileSync("src/commands/utility.js", code);
