import fs from "fs";
let loader = fs.readFileSync("src/commands/loader.js", "utf8");

loader = "import { commands as remoteCmds } from './remote.js';\n" + loader;

loader = loader.replace(
    /export const allCommands = \[/,
    "export const allCommands = [\n  ...remoteCmds,"
);

fs.writeFileSync("src/commands/loader.js", loader);
