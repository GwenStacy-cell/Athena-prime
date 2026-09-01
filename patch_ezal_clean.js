import fs from "fs";
let js = fs.readFileSync("src/commands/ezal.js", "utf8");
js = js.replace(/<:dark4luvontop:1533860081916182721>/g, "<:ticks:1533860039213842565>");
js = js.replace(/Failed\/Skipped \(No JTC Setup\):/g, "<:off:1533844858983157851> Failed/Skipped (No JTC Setup):");
js = js.replace(/Backup Failed/g, "<:off:1533844858983157851> Failed");
js = js.replace(/Restore Failed/g, "<:off:1533844858983157851> Failed");
fs.writeFileSync("src/commands/ezal.js", js);
