import fs from "fs";
let js = fs.readFileSync("src/events/interactionCreate.js", "utf8");

// Remove the local patch
js = js.replace(/\/\/ Globally upgrade Discord's native 'thinking\.\.\.' state[\s\S]*?try \{/, "try {");
fs.writeFileSync("src/events/interactionCreate.js", js);
