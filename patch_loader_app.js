import fs from "fs";
let js = fs.readFileSync("src/commands/loader.js", "utf8");

js = js.replace("import { commands as quoteCmds } from './quote.js';", "import { commands as quoteCmds } from './quote.js';\nimport { commands as appCmds } from './app.js';");
js = js.replace("  ...quoteCmds,", "  ...quoteCmds,\n  ...appCmds,");

fs.writeFileSync("src/commands/loader.js", js);

let helpJs = fs.readFileSync("src/commands/utility.js", "utf8");

helpJs = helpJs.replace(
  "'`!quotemaker` - Interactive canvas quote generator `[public]`', '`!quote setchannel` `#channel` - Bind a dedicated Auto-Quote channel `[admin]`'] }",
  "'`!quotemaker` - Interactive canvas quote generator `[public]`', '`!quote setchannel` `#channel` - Bind a dedicated Auto-Quote channel `[admin]`', '`!app setup` - Interactive CV2 Staff App Manager `[admin]`', '`!app setlog` `#channel` - Bind where applications are sent `[admin]`', '`!app deploy` `#channel` - Drop the Apply button `[admin]`'] }"
);

fs.writeFileSync("src/commands/utility.js", helpJs);
