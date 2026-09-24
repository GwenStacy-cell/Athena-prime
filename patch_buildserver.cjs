const fs = require('fs');
let code = fs.readFileSync('src/commands/buildserver.js', 'utf8');

code = code.replace(
  /await newGeneral\.send\(\{\s*components: \[\s*cv2\.success\([\s\S]*?\)\s*\],\s*flags: 32768\s*\}\);/m,
  "await newGeneral.send(cv2.success('Server Build Complete', 'Successfully deployed the **Athena Support Server** aesthetic layout.\\n\\nAll features (Welcome, JTC, Tickets, etc) now have designated channels.'));"
);

fs.writeFileSync('src/commands/buildserver.js', code);
console.log('Fixed cv2.success nesting in buildserver.js');
