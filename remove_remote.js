import fs from "fs";
let loader = fs.readFileSync("src/commands/loader.js", "utf8");

loader = loader.replace("import { commands as remoteCmds } from './remote.js';\n", "");
loader = loader.replace("  ...remoteCmds,\n", "");

fs.writeFileSync("src/commands/loader.js", loader);
