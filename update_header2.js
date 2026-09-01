import fs from "fs";

let sec = fs.readFileSync("src/commands/security.js", "utf8");

const oldHeaderRegex = /const headerSection = \{ type: 10, content: `# SECURITY FIREWALL STATUS\\n` \+[\s\S]*?`-# \*\*Predictive Layer:\*\* \$\{isSecured \? 'Online \\u2014 Behavioral scanning active' : 'Disabled'\}`\s*?\};/;

const newHeader = `const headerSection = { type: 10, content: 
      "-# **SECURITY FIREWALL STATUS**\\n" +
      "-# Global Status: " + (isSecured ? "**God-Tier Firewall ACTIVE**" : "Offline \\u2014 Unprotected") + "\\n" +
      "-# Strike Velocity: " + (isSecured ? "Ludicrously fast \\u2014 **1-3ms execution**" : "Disabled") + "\\n" +
      "-# Predictive Layer: " + (isSecured ? "Online \\u2014 **Behavioral scanning active**" : "Disabled")
    };`;

sec = sec.replace(oldHeaderRegex, newHeader);
fs.writeFileSync("src/commands/security.js", sec);
console.log("Replaced:", sec.includes("Ludicrously"));
