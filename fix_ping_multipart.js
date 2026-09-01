import fs from "fs";
let code = fs.readFileSync("src/commands/utility.js", "utf8");

code = code.replaceAll(
    "await message.reply({ components: [{ type: 17, components: comps }], files: [attachment], flags: 16384 });",
    "await message.reply({ components: [{ type: 17, components: comps }], flags: 16384 });\n        await message.channel.send({ files: [attachment] });"
);

code = code.replaceAll(
    "await interaction.followUp({ components: [{ type: 17, components: comps }], files: [attachment], flags: 16384 });",
    "await interaction.followUp({ components: [{ type: 17, components: comps }], flags: 16384 });\n        await interaction.followUp({ files: [attachment] });"
);

fs.writeFileSync("src/commands/utility.js", code);
