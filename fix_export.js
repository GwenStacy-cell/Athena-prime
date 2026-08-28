import fs from 'fs';
let code = fs.readFileSync('src/statsDB.js', 'utf8');

const targetStr = `  getTopMembers,
  getTopVoiceMembers
};`;

const replacementStr = `  getTopMembers,
  getTopVoiceMembers,
  logInvite,
  logLeave,
  getTopInvites,
  getUserInvites
};`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('src/statsDB.js', code);
