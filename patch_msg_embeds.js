import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

js = js.replace(/await message\.channel\.send\(scamEmbed\)/g, "await message.channel.send({ embeds: [scamEmbed] })");
js = js.replace(/await owner\.send\(dmEmbed\)/g, "await owner.send({ embeds: [dmEmbed] })");
js = js.replace(/await ownerUser\.send\(dmEmbed\)/g, "await ownerUser.send({ embeds: [dmEmbed] })");

fs.writeFileSync("src/events/messageCreate.js", js);
