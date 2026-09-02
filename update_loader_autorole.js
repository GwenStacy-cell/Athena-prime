import fs from "fs";
let js = fs.readFileSync("src/commands/loader.js", "utf8");

js = js.replace("import autoreactCmd from './autoreact.js';", "import autoreactCmd from './autoreact.js';\nimport autoroleCmd from './autorole.js';");
js = js.replace("  autoreactCmd\n];", "  autoreactCmd,\n  autoroleCmd\n];");

fs.writeFileSync("src/commands/loader.js", js);
