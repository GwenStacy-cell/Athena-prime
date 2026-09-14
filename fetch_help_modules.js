import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const start = js.indexOf("const helpModules = [");
const end = js.indexOf("];", start) + 2;

console.log(js.substring(start, end));
