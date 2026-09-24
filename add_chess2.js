import fs from 'fs';
const pkg = JSON.parse(fs.readFileSync('package.json'));
pkg.dependencies['chess.js'] = '^1.4.0';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
