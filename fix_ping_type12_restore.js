import fs from "fs";
let code = fs.readFileSync("src/commands/utility.js", "utf8");

code = code.replaceAll(
    "const comps = [\n        { type: 10, content: `-# **| <:dark4luvontop:1533860081916182721> ${message.author} ${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**` }\n      ];",
    "const comps = [\n        { type: 10, content: `-# **| <:dark4luvontop:1533860081916182721> ${message.author} ${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**` },\n        { type: 12, items: [{ media: { url: 'attachment://ping_graph.png' } }] }\n      ];"
);

code = code.replaceAll(
    "const comps = [\n        { type: 10, content: `-# **| <:dark4luvontop:1533860081916182721> ${interaction.user} ${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**` }\n      ];",
    "const comps = [\n        { type: 10, content: `-# **| <:dark4luvontop:1533860081916182721> ${interaction.user} ${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**` },\n        { type: 12, items: [{ media: { url: 'attachment://ping_graph.png' } }] }\n      ];"
);

// ALSO add flags: 16384 to editReply just in case Discord API drops it!
code = code.replaceAll(
    "await sent.edit({ content: '', components: [{ type: 17, components: comps }], files: [attachment], embeds: [] });",
    "await sent.edit({ content: '', components: [{ type: 17, components: comps }], files: [attachment], embeds: [], flags: 16384 });"
);

code = code.replaceAll(
    "await interaction.editReply({ content: '', components: [{ type: 17, components: comps }], files: [attachment], embeds: [] });",
    "await interaction.editReply({ content: '', components: [{ type: 17, components: comps }], files: [attachment], embeds: [], flags: 16384 });"
);


fs.writeFileSync("src/commands/utility.js", code);
