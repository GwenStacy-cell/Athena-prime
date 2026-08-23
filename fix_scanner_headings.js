import fs from 'fs';
let code = fs.readFileSync('src/commands/security.js', 'utf8');

// Replace all `# **` with `## **` inside handleScanServer
// I will just use regex to target the ones I added.

code = code.replace(/# \*\*SECURITY DIAGNOSTICS\*\*/g, '## **SECURITY DIAGNOSTICS**');
code = code.replace(/# \*\*TRUSTED PERSONNEL\*\*/g, '## **TRUSTED PERSONNEL**');
code = code.replace(/# \*\*WHITELISTED BOTS\*\*/g, '## **WHITELISTED BOTS**');
code = code.replace(/# \*\*HIGH-RISK PERSONNEL\*\*/g, '## **HIGH-RISK PERSONNEL**');
code = code.replace(/# \*\*UNAUTHORIZED BOTS\*\*/g, '## **UNAUTHORIZED BOTS**');

fs.writeFileSync('src/commands/security.js', code);
