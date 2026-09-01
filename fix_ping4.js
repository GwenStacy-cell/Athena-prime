import fs from "fs";
let code = fs.readFileSync("src/commands/utility.js", "utf8");

const oldPrefixParts = [
  "const e = new EmbedBuilder()",
  "  .setColor(accentInt)",
  "  .setDescription(`| <:dark4luvontop:1533860081916182721> ${message.author} **${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**`)",
  "  .setImage('attachment://ping_graph.png');",
  "",
  "await sent.edit({ content: '', embeds: [e], files: [attachment] });"
];
const oldPrefixCode = oldPrefixParts.join('\n        ');

const newPrefixParts = [
  "const comps = [",
  "  { type: 10, content: `-# **| <:dark4luvontop:1533860081916182721> ${message.author} ${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**` },",
  "  { type: 12, items: [{ media: { url: 'attachment://ping_graph.png' } }] }",
  "];",
  "",
  "await sent.edit({ content: '', components: [{ type: 17, components: comps }], files: [attachment] });"
];
const newPrefixCode = newPrefixParts.join('\n        ');

code = code.replace(oldPrefixCode, newPrefixCode);


const oldSlashParts = [
  "const e = new EmbedBuilder()",
  "  .setColor(accentInt)",
  "  .setDescription(`| <:dark4luvontop:1533860081916182721> ${interaction.user} **${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**`)",
  "  .setImage('attachment://ping_graph.png');",
  "",
  "await interaction.editReply({ content: '', embeds: [e], files: [attachment] });"
];
const oldSlashCode = oldSlashParts.join('\n        ');

const newSlashParts = [
  "const comps = [",
  "  { type: 10, content: `-# **| <:dark4luvontop:1533860081916182721> ${interaction.user} ${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**` },",
  "  { type: 12, items: [{ media: { url: 'attachment://ping_graph.png' } }] }",
  "];",
  "",
  "await interaction.editReply({ content: '', components: [{ type: 17, components: comps }], files: [attachment] });"
];
const newSlashCode = newSlashParts.join('\n        ');

code = code.replace(oldSlashCode, newSlashCode);

fs.writeFileSync("src/commands/utility.js", code);
