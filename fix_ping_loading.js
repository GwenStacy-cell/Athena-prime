import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const replacement = '`<a:loading:1542155051286396938> **Athena Prime:** \\`${["Synchronizing neural network parameters...", "Querying regional database shards...", "Allocating memory buffers for task execution...", "Validating security payload hashes...", "Compiling component view hierarchies...", "Establishing secure websocket handshake...", "Fetching remote assets..."][Math.floor(Math.random() * 7)]}\\``';

js = js.replace(/'-# \*\*Calculating ping\.\.\.\*\*'/g, replacement);

fs.writeFileSync("src/commands/utility.js", js);
