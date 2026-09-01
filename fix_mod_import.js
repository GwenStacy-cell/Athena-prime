import fs from "fs";

let text = fs.readFileSync("src/commands/moderation.js", "utf8");

if (!text.includes("logServerEvent")) {
  text = text.replace(
    "import { executeQuarantine } from './security.js';",
    "import { executeQuarantine } from './security.js';\nimport { logServerEvent } from '../utils/serverLogger.js';"
  );
  fs.writeFileSync("src/commands/moderation.js", text);
}
