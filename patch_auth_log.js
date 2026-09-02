import fs from "fs";
let js = fs.readFileSync("src/commands/auth.js", "utf8");

js = js.replace("executePrefix: async (message, args) => {", "executePrefix: async (message, args) => {\nconsole.log('AUTH COMMAND EXECUTING!');");

fs.writeFileSync("src/commands/auth.js", js);
