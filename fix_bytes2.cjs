
const fs = require('fs');
let code = fs.readFileSync('src/commands/security.js', 'utf8');

code = code.replace(/Athena Prime.*God-Tier/g, 'Athena Prime - God-Tier');
code = code.replace(/strike engine active.*nuke bots/g, 'strike engine active - nuke bots');
code = code.replace(/God-Tier Firewall.*Fully Operational/g, 'God-Tier Firewall - Fully Operational');
code = code.replace(/Server Info.*\\\\n/g, 'Server Info -\\\\n');
code = code.replace(/User Info.*\\\\n/g, 'User Info -\\\\n');
code = code.replace(/Security Status.*\\\\n/g, 'Security Status -\\\\n');
code = code.replace(/Not Set.*run/g, 'Not Set - run');
code = code.replace(/Not Set.*use/g, 'Not Set - use');
code = code.replace(/fully disabled.*all links/g, 'fully disabled - all links');
code = code.replace(/channels.*quarantined users/g, 'channels - quarantined users');
code = code.replace(/SECURITY TOGGLE ALL.*Bot/g, 'SECURITY TOGGLE ALL - Bot');
code = code.replace(/QRMANAGER.*Quarantine/g, 'QRMANAGER - Quarantine');
code = code.replace(/LINKSALLOW.*Per/g, 'LINKSALLOW - Per');
code = code.replace(/MASS QUARANTINE.*Quarantine/g, 'MASS QUARANTINE - Quarantine');
code = code.replace(/MASS UNQUARANTINE.*Release/g, 'MASS UNQUARANTINE - Release');
code = code.replace(/Safety guard.*prevent/g, 'Safety guard - prevent');

fs.writeFileSync('src/commands/security.js', code, 'utf8');
console.log('Fixed using fuzzy regex');

