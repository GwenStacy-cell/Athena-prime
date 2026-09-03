import fs from "fs";
let js = fs.readFileSync("index.js", "utf8");

// Remove the line "this.deferred = true; // mimic internal state"
js = js.replace("this.deferred = true; // mimic internal state", "");

fs.writeFileSync("index.js", js);
