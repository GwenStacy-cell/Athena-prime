import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

text = text.replace(
    /await targetMember\.send\(\{ embeds: \[dmEmbed\] \}\)\.catch\(\(\) => null\);/g,
    "await targetMember.send(dmEmbed).catch(() => null);"
);

text = text.replace(
    /await quarantineChannel\.send\(\{ content: `\$\{targetMember\}`, embeds: \[welcomeEmbed\] \}\)\.catch\(\(\) => null\);/g,
    "await quarantineChannel.send(Object.assign({ content: `${targetMember}` }, welcomeEmbed)).catch(() => null);"
);

fs.writeFileSync("src/commands/security.js", text);
