import fs from "fs";
let js = fs.readFileSync("src/utils/dashboardManager.js", "utf8");

js = js.replace(/guild\.roles\.everyone\.id/g, "guild.id");

fs.writeFileSync("src/utils/dashboardManager.js", js);
