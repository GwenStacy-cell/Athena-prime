import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

const target = `// Intercept message immediately
          try {
            message.delete().catch(() => null);`;

const replace = `// Intercept message immediately
          try {
            if (!message.client.ignoredDeletes) message.client.ignoredDeletes = new Set();
            message.client.ignoredDeletes.add(message.id);
            message.delete().catch(() => null);`;

js = js.replace(target, replace);
fs.writeFileSync("src/events/messageCreate.js", js);
