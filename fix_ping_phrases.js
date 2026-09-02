import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const oldPhrases = '["Synchronizing neural network parameters...", "Querying regional database shards...", "Allocating memory buffers for task execution...", "Validating security payload hashes...", "Compiling component view hierarchies...", "Establishing secure websocket handshake...", "Fetching remote assets..."]';

const newPhrases = '["Measuring Discord API gateway latency...", "Pinging regional server clusters...", "Awaiting acknowledgment from Discord servers...", "Synchronizing internal clock with Discord API...", "Tracing packet route to Discord gateway...", "Calculating websocket round-trip latency...", "Measuring read/write speed of local database..."]';

js = js.replace(oldPhrases, newPhrases);
js = js.replace(oldPhrases, newPhrases);

fs.writeFileSync("src/commands/utility.js", js);
