import fs from "fs";

let sec = fs.readFileSync("src/commands/security.js", "utf8");

const oldHeader = "    const headerSection = { type: 10, content: `# SECURITY FIREWALL STATUS\\n` +\n            `-# **Global Status:** ${isSecured ? 'God-Tier Firewall ACTIVE' : 'Offline \\u2014 Unprotected'}\\n` +\n            `-# **Strike Engine:** ${isSecured ? 'Raw API \\u2014 ~1-3ms elimination' : 'Disabled'}\\n` +\n            `-# **Predictive Layer:** ${isSecured ? 'Online \\u2014 Behavioral scanning active' : 'Disabled'}`\n       };";

const newHeader = "    const headerSection = { type: 10, content: `-# **SECURITY FIREWALL STATUS**\\n` +\n            `-# Global Status: ${isSecured ? '**God-Tier Firewall ACTIVE**' : 'Offline \\u2014 Unprotected'}\\n` +\n            `-# Strike Velocity: ${isSecured ? 'Ludicrously fast \\u2014 **1-3ms execution**' : 'Disabled'}\\n` +\n            `-# Predictive Layer: ${isSecured ? 'Online \\u2014 **Behavioral scanning active**' : 'Disabled'}`\n       };";

sec = sec.replace(oldHeader, newHeader);
fs.writeFileSync("src/commands/security.js", sec);
