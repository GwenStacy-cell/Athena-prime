import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

js = js.replace(
  /\/\/ Intercept message immediately\s*try \{\s*message\.delete\(\)\.catch\(\(\) => null\);/g,
  `// Intercept message immediately\n          try {\n            if (!message.client.ignoredDeletes) message.client.ignoredDeletes = new Set();\n            message.client.ignoredDeletes.add(message.id);\n            message.delete().catch(() => null);`
);

fs.writeFileSync("src/events/messageCreate.js", js);
