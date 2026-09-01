import fs from "fs";
let js = fs.readFileSync("index.js", "utf8");
js = js.replace(/process\.on\('uncaughtException',\s*\(error\)\s*=>\s*\{[\s\S]*?\}\);/m, 
`process.on('uncaughtException', (error) => {
  if (error && error.message && error.message.includes('Unexpected server response: 522')) {
    // Silence harmless Discord Voice API Cloudflare timeouts
    return;
  }
  console.error(chalk.red.bold('Uncaught Exception:'), error);
});`);
fs.writeFileSync("index.js", js);
