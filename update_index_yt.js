import fs from "fs";
let js = fs.readFileSync("index.js", "utf8");

const importStmt = "import { startYtStatsEngine } from './src/utils/ytStatsEngine.js';\n\nclient.once('ready'";
js = js.replace("client.once('ready'", importStmt);

const startStmt = "  console.log(`[BOT] Logged in as ${client.user.tag}`);\n  startYtStatsEngine(client);";
js = js.replace("  console.log(`[BOT] Logged in as ${client.user.tag}`);", startStmt);

fs.writeFileSync("index.js", js);
