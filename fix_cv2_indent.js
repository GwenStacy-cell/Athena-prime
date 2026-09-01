import fs from "fs";
let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

text = text.replace(
    /\\n> ╰› has been warned/g,
    "\\n>        ╰› has been warned"
);

text = text.replace(
    /\\n> ╰› has been automatically/g,
    "\\n>        ╰› has been automatically"
);

fs.writeFileSync("src/events/messageCreate.js", text);
