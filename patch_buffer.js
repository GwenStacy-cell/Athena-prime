import fs from "fs";
let js = fs.readFileSync("src/commands/tts.js", "utf8");
js = js.replace(/await response\.buffer\(\)/g, "Buffer.from(await response.arrayBuffer())");
fs.writeFileSync("src/commands/tts.js", js);

let js2 = fs.readFileSync("src/utils/mediaDownloader.js", "utf8");
js2 = js2.replace(/await res\.buffer\(\)/g, "Buffer.from(await res.arrayBuffer())");
js2 = js2.replace(/await videoRes\.buffer\(\)/g, "Buffer.from(await videoRes.arrayBuffer())");
fs.writeFileSync("src/utils/mediaDownloader.js", js2);
