import fs from "fs";
let lines = fs.readFileSync("src/commands/utility.js", "utf8").split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("components: [{ type: 17, components: [{ type: 10, content: `<a:loading:1542155051286396938> **Athena Prime:** \\`")) {
    lines[i] = "        components: [{ type: 17, components: [{ type: 10, content: `-# <a:loading:1542155051286396938> **Athena Prime:** ${[\"Measuring Discord API gateway latency...\", \"Pinging regional server clusters...\", \"Awaiting acknowledgment from Discord servers...\", \"Synchronizing internal clock with Discord API...\", \"Tracing packet route to Discord gateway...\", \"Calculating websocket round-trip latency...\", \"Measuring read/write speed of local database...\"][Math.floor(Math.random() * 7)]}` }] }],";
  }
}
fs.writeFileSync("src/commands/utility.js", lines.join("\n"));
