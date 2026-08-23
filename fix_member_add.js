import fs from 'fs';
let code = fs.readFileSync('src/events/guildMemberAdd.js', 'utf8');

if (!code.includes('import statsDB')) {
  code = code.replace("import db from '../database.js';", "import db from '../database.js';\nimport statsDB from '../statsDB.js';");
}

const injectTarget = "const inviteChannel = guild.channels.cache.get(config.inviteChannelId);";
const injectCode = `if (usedInvite?.inviter) {
          statsDB.logInvite(guild.id, usedInvite.inviter.id, member.id);
        }
        
        const inviteChannel = guild.channels.cache.get(config.inviteChannelId);`;

code = code.replace(injectTarget, injectCode);
fs.writeFileSync('src/events/guildMemberAdd.js', code);
