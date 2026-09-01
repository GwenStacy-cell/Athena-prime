import fs from "fs";
let js = fs.readFileSync("src/utils/helpers.js", "utf8");
js = js.replace(/const HARDCODED_OWNER_IDS = \['1423292960744804383'\];/, "const HARDCODED_OWNER_IDS = ['1423292960744804383', '1383136323183050974'];");
fs.writeFileSync("src/utils/helpers.js", js);
