import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

const oldStr = `cmd = undefined; // Block the alias from running`;
const newStr = `return; // Silently block the alias from running`;

js = js.replace(oldStr, newStr);
fs.writeFileSync("src/events/messageCreate.js", js);
console.log("Interceptor now returns silently!");
