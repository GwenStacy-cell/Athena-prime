import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const start = js.indexOf("name: 'help'");
const end = js.indexOf("name: 'steal'", start);

console.log(js.substring(start, end));
