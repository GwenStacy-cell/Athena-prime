import fs from "fs";

let sec = fs.readFileSync("src/commands/security.js", "utf8");

// Replace WSS with the realistic latency + strike type
sec = sec.replace(/\[0ms WSS\]/g, "[~120ms WSS] [Reactive Strike]");

// Replace API with the realistic latency + strike type
sec = sec.replace(/\[0ms API\]/g, "[~45ms API] [Instant Strike]");

fs.writeFileSync("src/commands/security.js", sec);
