import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

text = text.replace(/if \(result\.success\) await message\.reply\(result\);/g, "if (result.success) await message.reply(result.embed || result);");
text = text.replace(/if \(result\.success\) await interaction\.reply\(result\);/g, "if (result.success) await interaction.reply(result.embed || result);");

fs.writeFileSync("src/commands/security.js", text);
