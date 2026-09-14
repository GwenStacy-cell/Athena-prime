import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

js = js.replace(/await interaction\.channel\.send\(tosPanel\);/g, "if (interaction.channel) await interaction.channel.send(tosPanel).catch(() => null);");
js = js.replace(/await interaction\.channel\.send\(panel\);/g, "if (interaction.channel) await interaction.channel.send(panel).catch(() => null);");

fs.writeFileSync("src/commands/security.js", js);
