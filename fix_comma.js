import fs from "fs";
let ezal = fs.readFileSync("src/commands/ezal.js", "utf8");
ezal = ezal.replace("      },,", "      },");
fs.writeFileSync("src/commands/ezal.js", ezal);
