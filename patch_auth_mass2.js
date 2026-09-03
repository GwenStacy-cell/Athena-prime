import fs from "fs";
let js = fs.readFileSync("src/commands/auth.js", "utf8");
js = js.replace(/!massrole/g, "!massaddrole");
fs.writeFileSync("src/commands/auth.js", js);
