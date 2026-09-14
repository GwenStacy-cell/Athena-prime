import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

if (!js.includes("import { isBotAuthorized }")) {
    js = js.replace("import { canModerate, logToSecurityChannel, isAuthorized, isBotOwnerSync, getPresenceStatus, findClosestCommand } from '../utils/helpers.js';",
    "import { canModerate, logToSecurityChannel, isAuthorized, isBotOwnerSync, getPresenceStatus, findClosestCommand } from '../utils/helpers.js';\nimport { isBotAuthorized } from '../utils/antinuke.js';");
    js = js.replace("const { isBotAuthorized } = await import('../utils/antinuke.js');", "");
    fs.writeFileSync("src/events/messageCreate.js", js);
    console.log("Optimized imports for unauthorized bot spam auto-delete!");
} else {
    console.log("Already optimized.");
}
