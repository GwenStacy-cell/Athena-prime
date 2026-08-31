import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

text = text.replace(
    /const \{ ContainerBuilder, TextDisplayBuilder, SeparatorBuilder \} = await import\('\.\.\/cv2\.js'\);/g,
    "const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = await import('discord.js');"
);

fs.writeFileSync("src/commands/security.js", text);
