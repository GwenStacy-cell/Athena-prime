import fs from "fs";
let loader = fs.readFileSync("src/commands/loader.js", "utf8");

loader = loader.replace(
    "import { commands as topCmds } from './top.js';",
    "import { commands as topCmds } from './top.js';\nimport { commands as siCmds } from './si.js';"
);

loader = loader.replace(
    "  ...topCmds,",
    "  ...topCmds,\n  ...siCmds,"
);

fs.writeFileSync("src/commands/loader.js", loader);
