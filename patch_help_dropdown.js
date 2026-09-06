import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

js = js.replace(
  /label: mod\.label,\s*value: mod\.id,\s*emoji: mod\.emoji/g,
  `label: mod.label,\n          value: mod.id`
);

fs.writeFileSync("src/commands/utility.js", js);
