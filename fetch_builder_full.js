import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const start = js.indexOf("let rawComponents = [];");
const end = js.indexOf("const helpModules =", start);

console.log(js.substring(start, end));
