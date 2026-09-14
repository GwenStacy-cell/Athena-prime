import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const oldStr1 = "'-# 🛡️ **Anti-Nuke Engine:** **A predictive, zero-tolerance firewall that neutralizes structural threats in milliseconds and autonomously reconstructs deleted channels, roles, and server hierarchies via intelligent caching.**\\n' +";

const newStr1 = "'-# 🛡️ **Anti-Nuke Engine:** **A predictive, zero-tolerance firewall powered by <1ms Raw Websocket Wiretap and 10ms API polling. It neutralizes structural threats instantly, unbans victims, and enforces flawless exact-position restoration for channels, hierarchies, and deep custom emojis.**\\n' +";

js = js.replace(oldStr1, newStr1);

fs.writeFileSync("src/commands/utility.js", js);
console.log("Updated utility.js successfully");
