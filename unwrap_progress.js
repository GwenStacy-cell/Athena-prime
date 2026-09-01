import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

text = text.replace(/if \(!statusMsg\) statusMsg = await message\.reply\(\{ embeds: \[embedData\] \}\)\.catch\(\(\) => null\);/g, "if (!statusMsg) statusMsg = await message.reply(embedData).catch(() => null);");
text = text.replace(/else await statusMsg\.edit\(\{ embeds: \[embedData\] \}\)\.catch\(\(\) => null\);/g, "else await statusMsg.edit(embedData).catch(() => null);");
text = text.replace(/await interaction\.editReply\(\{ embeds: \[embedData\] \}\)\.catch\(\(\) => null\);/g, "await interaction.editReply(embedData).catch(() => null);");

fs.writeFileSync("src/commands/security.js", text);
