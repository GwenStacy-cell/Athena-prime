import fs from "fs";
let js = fs.readFileSync("src/utils/antiScam.js", "utf8");
js = js.replace(/if \(\!msg\.includes\('Unsupported image type'\) && \!msg\.includes\('Image too small'\) && \!msg\.includes\('Line cannot be recognized'\)\) \{/g, 
"if (!msg.includes('Unsupported image type') && !msg.includes('Image too small') && !msg.includes('Line cannot be recognized') && !msg.includes('FetchError') && !msg.includes('ECONNRESET')) {");
fs.writeFileSync("src/utils/antiScam.js", js);
