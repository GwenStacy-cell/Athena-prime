import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const start = js.indexOf("function buildHelpContainer");
const end = js.indexOf("export const commands =", start);

console.log(js.substring(start, end));
