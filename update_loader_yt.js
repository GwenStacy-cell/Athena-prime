import fs from "fs";
let js = fs.readFileSync("src/commands/loader.js", "utf8");

js = js.replace("import autoroleCmd from './autorole.js';", "import autoroleCmd from './autorole.js';\nimport ytstatsCmd from './ytstats.js';");
js = js.replace("  autoroleCmd\n];", "  autoroleCmd,\n  ytstatsCmd\n];");

fs.writeFileSync("src/commands/loader.js", js);
