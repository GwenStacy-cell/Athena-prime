import fs from "fs";
let js = fs.readFileSync("src/commands/loader.js", "utf8");

js = js.replace(/  uploadCmd\r?\n\];/, "  uploadCmd,\n  autoreactCmd\n];");

fs.writeFileSync("src/commands/loader.js", js);
