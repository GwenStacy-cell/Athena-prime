
import fs from "fs";
let code = fs.readFileSync("src/database.js", "utf8");

const target = "raidMode: false,";
const replacement = `raidMode: false,
          twoFactorEmail: null,
          twoFactorVerified: false,
          pendingTwoFactorCode: null,`;

code = code.replace(target, replacement);
fs.writeFileSync("src/database.js", code);
console.log("Updated database.js with 2FA fields");

