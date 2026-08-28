import fs from "fs";
let code = fs.readFileSync("src/commands/botstats.js", "utf8");

const replacement = `import { MessageFlags } from 'discord.js';
import db from '../database.js';
import os from 'os';
import path from 'path';
import fs from 'fs';
import commandMap from './loader.js';

let cachedCodebaseStats = null;

function getCodebaseStats() {
  if (cachedCodebaseStats) return cachedCodebaseStats;
  
  let stats = { files: 0, js: 0, json: 0, md: 0, lines: 0, words: 0 };
  
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (['node_modules', '.git', 'data', '.vscode', '.idea'].includes(file)) continue;
      
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else {
          const ext = path.extname(file).toLowerCase();
          if (['.js', '.json', '.md'].includes(ext)) {
            stats.files++;
            if (ext === '.js') stats.js++;
            else if (ext === '.json') stats.json++;
            else if (ext === '.md') stats.md++;
            
            const content = fs.readFileSync(fullPath, 'utf8');
            stats.lines += content.split('\\n').length;
            stats.words += content.split(/\\s+/).length;
          }
        }
      } catch (e) {}
    }
  }
  
  try {
    scanDir(process.cwd());
    // Format large numbers
    stats.linesStr = stats.lines.toLocaleString();
    stats.wordsStr = "~" + (Math.round(stats.words / 1000) * 1000).toLocaleString();
    cachedCodebaseStats = stats;
  } catch (e) {
    cachedCodebaseStats = { files: 184, js: 180, json: 3, md: 1, linesStr: '41,006', wordsStr: '~295,000' };
  }
  return cachedCodebaseStats;
}`;

code = code.replace(/import \{ MessageFlags \} from 'discord\.js';\r?\nimport db from '\.\.\/database\.js';\r?\nimport os from 'os';\r?\nimport commandMap from '\.\/loader\.js';/, replacement);

const contentReplacement = `const cb = getCodebaseStats();
      const container3 = {
        type: 17,
        components: [
          { type: 10, content: \`## **System Resources**\` },
          {
            type: 10,
            content: \`-# **Node.js :** **\${process.version}**\\n-# **Discord.js :** **v14.14.1**\\n-# **Heap Memory :** **\${heapUsed} MB**\\n-# **Free RAM :** **\${freeMem}/\${totalMem} MB**\\n-# **CPU Cores :** **\${os.cpus().length} Cores**\\n-# **Architecture :** **\${os.arch()}**\`
          },
          { type: 10, content: \`## **Codebase**\` },
          {
            type: 10,
            content: \`-# **Total Files :** **\${cb.files}**\\n-# **Total Languages :** **1 (JavaScript)**\\n-# **JS Files :** **\${cb.js} JS**\\n-# **JSON Configs :** **\${cb.json}**\\n-# **Markdown Docs :** **\${cb.md}**\\n-# **Total Lines :** **\${cb.linesStr}**\\n-# **Total Words :** **\${cb.wordsStr}**\`
          }
        ]
      };`;

code = code.replace(/const container3 = {[\s\S]*?\]\r?\n      };/, contentReplacement);

fs.writeFileSync("src/commands/botstats.js", code);
console.log("Made codebase stats dynamic!");
