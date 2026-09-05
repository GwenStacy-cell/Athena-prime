import fs from "fs";
let js = fs.readFileSync("index.js", "utf8");

js = js.replace(
  /if \(error\?\.message\?\.includes\('Cannot perform IP discovery - socket closed'\)\) return;/g,
  `if (error?.message?.includes('Cannot perform IP discovery - socket closed')) return;\n  if (error?.code === 10062 || error?.code === 50035 || error?.message?.includes('Unknown interaction') || error?.message?.includes('Unknown message')) return;`
);

js = js.replace(
  /code === 'UND_ERR_CONNECT_TIMEOUT'\) \{/g,
  `code === 'UND_ERR_CONNECT_TIMEOUT' ||\n        code === 10062 ||\n        code === 50035 ||\n        msg.includes('Unknown interaction') ||\n        msg.includes('Unknown message')) {`
);

fs.writeFileSync("index.js", js);
