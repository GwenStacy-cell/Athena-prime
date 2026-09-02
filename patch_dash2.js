import fs from "fs";
let js = fs.readFileSync("src/utils/dashboardManager.js", "utf8");
js = js.replace(/console\.error\(`\[Dashboard Sync\] Failed to edit messages in \$\{guild\.id\}:`, err\.message\);/, 
`if (err && !err.message?.includes('ECONNRESET') && !err.message?.includes('Connect Timeout') && err.code !== 'ECONNRESET') {
            console.error(\`[Dashboard Sync] Failed to edit messages in \${guild.id}:\`, err.message);
          }`);
fs.writeFileSync("src/utils/dashboardManager.js", js);
