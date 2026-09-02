import fs from "fs";
let js = fs.readFileSync("src/commands/ytstats.js", "utf8");

js = js.replace(
  "Use `{count}` where you want the number to appear (e.g. `🔴 Subs: {count}`).",
  "Use `{subs}` and `{videos}` where you want the numbers to appear (e.g. `🔴 Subs: {subs}`)."
);

fs.writeFileSync("src/commands/ytstats.js", js);
