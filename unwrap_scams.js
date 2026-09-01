import fs from "fs";
let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

text = text.replace(/await logChannel\.send\(\{ embeds: \[scamEmbed\] \}\)/g, "await logChannel.send(scamEmbed)");
text = text.replace(/await logChannel\.send\(\{ embeds: \[scamImgEmbed\] \}\)/g, "await logChannel.send(scamImgEmbed)");
text = text.replace(/await message\.channel\.send\(\{ embeds: \[scamEmbed\] \}\)/g, "await message.channel.send(scamEmbed)");

fs.writeFileSync("src/events/messageCreate.js", text);
