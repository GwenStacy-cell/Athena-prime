import fs from "fs";
let js = fs.readFileSync("src/database.js", "utf8");

js = js.replace(
  "          ignoredCategories: [],",
  "          ignoredCategories: [],\n          quoteChannelId: null,"
);

fs.writeFileSync("src/database.js", js);
