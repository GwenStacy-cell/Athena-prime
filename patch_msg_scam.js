import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

// Fix channel warning embed
js = js.replace("await message.channel.send(scamEmbed).then(m => setTimeout(() => m.delete().catch(()=>null), 5000));", "await message.channel.send({ embeds: [scamEmbed] }).then(m => setTimeout(() => m.delete().catch(()=>null), 5000));");

// Fix owner DM embed
js = js.replace("await owner.send(dmEmbed).catch(() => null);", "await owner.send({ embeds: [dmEmbed] }).catch(() => null);");

fs.writeFileSync("src/events/messageCreate.js", js);
