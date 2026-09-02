import fs from "fs";
let js = fs.readFileSync("src/events/ready.js", "utf8");

const webSubInit = "    // Start WebSub Push Notification Server\n    initWebSub(client);";
const replaceInit = "    // Start WebSub Push Notification Server\n    initWebSub(client);\n\n    // Start YT Stats Engine\n    startYtStatsEngine(client);";

js = js.replace(webSubInit, replaceInit);
fs.writeFileSync("src/events/ready.js", js);
