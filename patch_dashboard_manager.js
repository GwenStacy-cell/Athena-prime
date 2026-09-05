import fs from "fs";
let js = fs.readFileSync("src/utils/dashboardManager.js", "utf8");

js = js.replace(
  /console\.error\('Failed to create dashboard channel:', err\); throw err;/g,
  `if (err.code === 30013 || err.code === 50013) {\n      console.log(\`[Dashboard] Skipped creating dashboard in \${guild.name} (\${err.code === 30013 ? '500 Channel Limit Reached' : 'Missing Permissions'})\`);\n    } else {\n      console.error('Failed to create dashboard channel:', err);\n    }`
);

fs.writeFileSync("src/utils/dashboardManager.js", js);
