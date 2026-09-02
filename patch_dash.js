import fs from "fs";
let js = fs.readFileSync("src/utils/dashboardManager.js", "utf8");
js = js.replace(/console\.error\('Failed to fetch audit logs for dashboard:', err\);/, 
`if (err && err.code !== 'UND_ERR_CONNECT_TIMEOUT' && !err.message?.includes('Connect Timeout')) {
      console.error('Failed to fetch audit logs for dashboard:', err);
    }`);
fs.writeFileSync("src/utils/dashboardManager.js", js);
