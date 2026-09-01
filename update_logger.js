import fs from "fs";

let text = fs.readFileSync("src/utils/serverLogger.js", "utf8");
text = text.replace(
    "await channel.send({ embeds: [embedData] }).catch(err => {",
    "let payload = (embedData.components || embedData.content) ? embedData : { embeds: [embedData] };\n    await channel.send(payload).catch(err => {"
);
fs.writeFileSync("src/utils/serverLogger.js", text);

