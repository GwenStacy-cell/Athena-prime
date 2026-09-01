import fs from "fs";
let code = fs.readFileSync("src/commands/utility.js", "utf8");

code = code.replaceAll(
    "const comps = [\n        { type: 10, content: `-# **| <:dark4luvontop:1533860081916182721> [${message.author.username}](https://discord.com/users/${message.author.id}) ${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**` }\n      ];\n\n      await sent.delete().catch(() => null);\n        await message.reply({ components: [{ type: 17, components: comps }], flags: MessageFlags.IsComponentsV2 });\n        await message.channel.send({ files: [attachment] });",
    "const comps = [\n        { type: 10, content: `-# **| <:dark4luvontop:1533860081916182721> [${message.author.username}](https://discord.com/users/${message.author.id}) ${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**` },\n        { type: 12, items: [{ media: { url: 'attachment://ping_graph.png' } }] }\n      ];\n\n      await sent.delete().catch(() => null);\n        await message.reply({ components: [{ type: 17, components: comps }], files: [attachment], flags: MessageFlags.IsComponentsV2 });"
);

code = code.replaceAll(
    "const comps = [\n        { type: 10, content: `-# **| <:dark4luvontop:1533860081916182721> [${interaction.user.username}](https://discord.com/users/${interaction.user.id}) ${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**` }\n      ];\n\n      await interaction.deleteReply().catch(() => null);\n        await interaction.followUp({ components: [{ type: 17, components: comps }], flags: MessageFlags.IsComponentsV2 });\n        await interaction.followUp({ files: [attachment] });",
    "const comps = [\n        { type: 10, content: `-# **| <:dark4luvontop:1533860081916182721> [${interaction.user.username}](https://discord.com/users/${interaction.user.id}) ${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**` },\n        { type: 12, items: [{ media: { url: 'attachment://ping_graph.png' } }] }\n      ];\n\n      await interaction.deleteReply().catch(() => null);\n        await interaction.followUp({ components: [{ type: 17, components: comps }], files: [attachment], flags: MessageFlags.IsComponentsV2 });"
);

fs.writeFileSync("src/commands/utility.js", code);
