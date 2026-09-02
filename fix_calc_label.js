import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

// Fix the empty button label error caused by Discord stripping normal spaces
js = js.replace(/\{ id: 'empty', label: ' ', style: ButtonStyle\.Secondary \}/g, 
  "{ id: 'empty', label: '\\u200B', style: ButtonStyle.Secondary }");

fs.writeFileSync("src/commands/utility.js", js);
