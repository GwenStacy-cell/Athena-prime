import fs from "fs";
let js = fs.readFileSync("src/commands/loader.js", "utf8");

const importCode = "import uploadCmd from './upload.js';\nimport autoreactCmd from './autoreact.js';";
js = js.replace("import uploadCmd from './upload.js';", importCode);

const arrayCode = "  uploadCmd,\n  autoreactCmd\n];";
js = js.replace("  uploadCmd\n];", arrayCode);

fs.writeFileSync("src/commands/loader.js", js);
