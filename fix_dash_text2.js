import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

code = code.replace(/\*\*List Dangerous Roles:\*\* /g, "-# **List Dangerous Roles:** ");
code = code.replace(/\*\*List Bots:\*\* /g, "-# **List Bots:** ");
code = code.replace(/\*\*Humans Having Dangerous roles:\*\* /g, "-# **Humans Having Dangerous Roles:** ");
code = code.replace(/\*\*Bots Having dangeurs roles:\*\* /g, "-# **Bots Having Dangerous Roles:** ");
code = code.replace(/\*\*Production Level Bots:\*\* /g, "-# **Production Level Bots:** ");
code = code.replace(/\*\*2FA Notification Gmail:\*\* /g, "-# **2FA Notification Gmail:** ");

fs.writeFileSync("src/commands/security.js", code);
console.log("Fixed dashboard text safely!");
