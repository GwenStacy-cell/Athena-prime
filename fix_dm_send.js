import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");
text = text.replace(/await targetMember\.send\(dmEmbed\)\.catch\(\(\) => null\);/g, "await targetMember.send({ embeds: [dmEmbed] }).catch(() => null);");
fs.writeFileSync("src/commands/security.js", text);
