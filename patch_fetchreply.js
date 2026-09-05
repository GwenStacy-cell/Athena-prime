import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

js = js.replace(
  /const payload = \{ \.\.\.embed, fetchReply: true \};/g,
  `const payload = { ...embed, withResponse: true };`
);

fs.writeFileSync("src/commands/utility.js", js);
