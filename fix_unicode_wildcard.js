import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

// Fix header
const oldHeader = "## **${guild.name} AAA?sAA,  Server Info**\\n-# **Comprehensive server statistics and Athena Prime security overview.**";
const newHeader = "## **${guild.name} — Server Info**\\n-# **Comprehensive server statistics and Athena Prime security overview.**";
code = code.replace(oldHeader, newHeader);
// Using a simpler regex to catch whatever junk is there
code = code.replace(/## \*\*.*?Server Info\*\*/g, "## **${guild.name} — Server Info**");

const oldSecStatus = "**AAA?sAAA?sAA, Security Status AAA?sAAA?sAA,**";
const newSecStatus = "**▬▬ Security Status ▬▬**";
code = code.replace(oldSecStatus, newSecStatus);
code = code.replace(/\*\*.*?Security Status.*?\*\*/g, "**▬▬ Security Status ▬▬**");

fs.writeFileSync("src/commands/security.js", code);
console.log("Fixed unicode via wildcard!");
