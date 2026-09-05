import fs from "fs";
let js = fs.readFileSync("src/commands/moderation.js", "utf8");

js = js.replace(
  /await interaction\.deferReply\(\);\s*const result = await handleUnbanAll\(interaction\.guild, interaction\.member\);\s*await interaction\.editReply\(result\);/g,
  `await interaction.deferReply();\n        const result = await handleUnbanAll(interaction.guild, interaction.member);\n        await interaction.deleteReply().catch(() => null);\n        await interaction.channel.send(result);`
);

fs.writeFileSync("src/commands/moderation.js", js);
