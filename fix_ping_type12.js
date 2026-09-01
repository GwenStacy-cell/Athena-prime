import fs from "fs";
let code = fs.readFileSync("src/commands/utility.js", "utf8");

code = code.replaceAll(
    "{ type: 12, items: [{ media: { url: 'attachment://ping_graph.png' } }] }",
    ""
);

code = code.replaceAll(
    "const comps = [\n        { type: 10, content: `-# **| <:dark4luvontop:1533860081916182721> ${message.author} ${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**` },\n        \n      ];",
    "const comps = [\n        { type: 10, content: `-# **| <:dark4luvontop:1533860081916182721> ${message.author} ${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**` }\n      ];"
);

code = code.replaceAll(
    "const comps = [\n        { type: 10, content: `-# **| <:dark4luvontop:1533860081916182721> ${interaction.user} ${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**` },\n        \n      ];",
    "const comps = [\n        { type: 10, content: `-# **| <:dark4luvontop:1533860081916182721> ${interaction.user} ${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**` }\n      ];"
);

fs.writeFileSync("src/commands/utility.js", code);
