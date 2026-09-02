import fs from "fs";
let lines = fs.readFileSync("index.js", "utf8").split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("content: `<a:loading:1542155051286396938> **Athena Prime:** \\`${randomText}\\``,")) {
    lines[i] = "      content: `-# <a:loading:1542155051286396938> **Athena Prime:** ${randomText}`,";
  }
}
fs.writeFileSync("index.js", lines.join("\n"));
