import fs from "fs";
let code = fs.readFileSync("src/events/interactionCreate.js", "utf8");

code = code.replace(/await import\('\.\.\/db\.js'\)/g, "await import('../database.js')");

fs.writeFileSync("src/events/interactionCreate.js", code);
console.log("Fixed db.js import!");
