import fs from 'fs';
let code = fs.readFileSync('src/events/guildMemberRemove.js', 'utf8');

if (!code.includes('import statsDB')) {
  code = code.replace("import db from '../database.js';", "import db from '../database.js';\nimport statsDB from '../statsDB.js';");
}

code = code.replace("if (!guild) return;", "if (!guild) return;\n\n    statsDB.logLeave(guild.id, member.id);");

fs.writeFileSync('src/events/guildMemberRemove.js', code);
