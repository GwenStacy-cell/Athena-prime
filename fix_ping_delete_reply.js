import fs from "fs";
let code = fs.readFileSync("src/commands/utility.js", "utf8");

code = code.replaceAll(
    "await sent.edit({ content: '', components: [{ type: 17, components: comps }], files: [attachment], embeds: [], flags: 16384 });",
    "await sent.delete().catch(() => null);\n        await message.reply({ components: [{ type: 17, components: comps }], files: [attachment], flags: 16384 });"
);

code = code.replaceAll(
    "await interaction.editReply({ content: '', components: [{ type: 17, components: comps }], files: [attachment], embeds: [], flags: 16384 });",
    "await interaction.deleteReply().catch(() => null);\n        await interaction.followUp({ components: [{ type: 17, components: comps }], files: [attachment], flags: 16384 });"
);

fs.writeFileSync("src/commands/utility.js", code);
