import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

const oldInit = "const initDisplay = new TextDisplayBuilder().setContent('> -# **SECURITY SHIELD SEQUENCE**\\n> \\n> -# <a:alert1:1533860044154732704> **INITIALIZING SECURITY PROTOCOLS...**');";
const newInit = "const initDisplay = new TextDisplayBuilder().setContent('> -# <a:loading:1542155051286396938> **Athena Prime Antinuke Setup**\\n> -# **Antinuke Setup Working...**');";

const oldInit2 = "const initDisplay2 = new TextDisplayBuilder().setContent('> -# **SECURITY SHIELD SEQUENCE**\\n> \\n> -# <a:alert1:1533860044154732704> **INITIALIZING SECURITY PROTOCOLS...**');";
const newInit2 = "const initDisplay2 = new TextDisplayBuilder().setContent('> -# <a:loading:1542155051286396938> **Athena Prime Antinuke Setup**\\n> -# **Antinuke Setup Working...**');";

code = code.replace(oldInit, newInit);
code = code.replace(oldInit2, newInit2);

fs.writeFileSync("src/commands/security.js", code);
console.log("Fixed init messages!");
