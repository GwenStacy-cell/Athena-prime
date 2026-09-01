import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

text = text.replace(
"name: 'antilink',\n        aliases: ['linksallow'],\n        description: 'Opens the interactive Antilink & Invite Module Dashboard (Admin only).',",
"name: 'automod',\n        aliases: ['automoderator', 'antilink'],\n        description: 'Opens the interactive Automated Moderation & Security Dashboard (Admin only).',"
);

// If standard replace failed, do it robustly:
text = text.replace(/name:\s*'antilink',\s*aliases:\s*\['linksallow'\],\s*description:\s*'Opens the interactive Antilink & Invite Module Dashboard \(Admin only\)\.',/g, 
"name: 'automod',\n        aliases: ['automoderator', 'antilink'],\n        description: 'Opens the interactive Automated Moderation & Security Dashboard (Admin only).',");

fs.writeFileSync("src/commands/security.js", text);
