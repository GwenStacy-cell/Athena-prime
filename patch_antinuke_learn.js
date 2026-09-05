import fs from "fs";
let js = fs.readFileSync("src/utils/antinuke.js", "utf8");

js = js.replace(
  /console\.log\(\`\[ML Engine\] Recorded signature: \$\{eventType\} by \$\{executor\.id\}\`\);\s*return; \/\/ Suppress punishment during training phase/g,
  `console.log(\`[ML Engine] Recorded signature: \${eventType} by \${executor.id}\`);`
);

fs.writeFileSync("src/utils/antinuke.js", js);
