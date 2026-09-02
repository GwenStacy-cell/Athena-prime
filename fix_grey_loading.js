import fs from "fs";
let js = fs.readFileSync("index.js", "utf8");

js = js.replace(/content: \\`<a:loading:1542155051286396938> \*\*Athena Prime:\*\* \\\\`\$\{randomText\}\\\\\\`\\`,/, 
  "content: `-# <a:loading:1542155051286396938> **Athena Prime:** ${randomText}`,");

fs.writeFileSync("index.js", js);
