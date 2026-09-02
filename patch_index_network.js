import fs from "fs";
let js = fs.readFileSync("index.js", "utf8");
js = js.replace(/process\.on\('uncaughtException',\s*\(error\)\s*=>\s*\{[\s\S]*?\}\);/m, 
`process.on('uncaughtException', (error) => {
  if (error) {
    const msg = error.message || '';
    const code = error.code || '';
    if (msg.includes('Unexpected server response: 5') || 
        msg.includes('Opening handshake has timed out') || 
        msg.includes('ECONNRESET') || 
        msg.includes('EPROTO') ||
        code === 'ECONNRESET' ||
        code === 'EPROTO' ||
        code === 'UND_ERR_CONNECT_TIMEOUT') {
      return;
    }
  }
  console.error(chalk.red.bold('Uncaught Exception:'), error);
});`);
fs.writeFileSync("index.js", js);
