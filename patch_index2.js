import fs from "fs";
let js = fs.readFileSync("index.js", "utf8");
js = js.replace(/includes\('Unexpected server response: 522'\)/g, "includes('Unexpected server response: 5')");
fs.writeFileSync("index.js", js);
