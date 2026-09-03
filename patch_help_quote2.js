import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

js = js.replace(
  "`!quote` `<msg_id|@user>` `[theme]` - Generate an aesthetic canvas quote `[public]`', '`!quotemaker` - Interactive canvas quote generator `[public]`'",
  "`!quote` `<msg_id|@user>` `[theme]` - Generate an aesthetic canvas quote `[public]`', '`!quotemaker` - Interactive canvas quote generator `[public]`', '`!quote setchannel` `#channel` - Bind a dedicated Auto-Quote channel `[admin]`'"
);

fs.writeFileSync("src/commands/utility.js", js);
