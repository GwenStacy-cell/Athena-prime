import fs from "fs";
let js = fs.readFileSync("src/events/webhookUpdate.js", "utf8");

js = js.replace(
  /name: 'webhookUpdate'/g,
  `name: 'webhooksUpdate'`
);

fs.writeFileSync("src/events/webhookUpdate.js", js);
