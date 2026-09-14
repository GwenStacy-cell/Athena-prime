import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

const start = js.indexOf("async function runSecurityEnableSequence");
const end = js.indexOf("async function getServerSecurityEnabledPanel", start);

console.log(js.substring(start, end));
