import fs from "fs";
let sec = fs.readFileSync("src/commands/security.js", "utf8");

const regex = /if \(bypasses\[rId\] && bypasses\[rId\]\.length > 0\) \{\s*bypassText \+= \`-# \*\*\| <@&\$\{rId\}> Bypasses:\*\* \$\{bypasses\[rId\]\.join\(\', \'\)\}\\n\`;\s*\}/m;

const newStr = `if (bypasses[rId] && bypasses[rId].length > 0) {
          const displayStr = bypasses[rId].length >= 10 ? 'All Automoderation Events' : bypasses[rId].join(', ');
          bypassText += \`-# **| <@&\${rId}> Bypasses:** \${displayStr}\\n\`;
        }`;

sec = sec.replace(regex, newStr);
fs.writeFileSync("src/commands/security.js", sec);
