import fs from "fs";

let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

text = text.replace(
    "// 1.6 HIDDEN URL FILTER\n      if (!checkBypass('Hidden URL Filter')) {",
    "// 1.6 HIDDEN URL FILTER\n      if (dbConfig.hiddenUrlEnabled !== false && !checkBypass('Hidden URL Filter')) {"
);

text = text.replace(
    "// 1.7 FILE CHECK\n      if (!checkBypass('File Check')) {",
    "// 1.7 FILE CHECK\n      if (dbConfig.fileCheckEnabled !== false && !checkBypass('File Check')) {"
);

fs.writeFileSync("src/events/messageCreate.js", text);
