
const fs = require('fs');
let code = fs.readFileSync('src/commands/ezal.js', 'utf8');

// 1. Add handleSpamPermit to switch
const switchTarget =     case 'takemyrole': return handleTakeMyRole(message, args);;
const switchReplace = switchTarget + \n    case 'spampermit': return handleSpamPermit(message, args);\n    case 'spamrevoke': return handleSpamRevoke(message, args);\n    case 'spamlist': return handleSpamList(message);;
code = code.replace(switchTarget, switchReplace);

// 2. Add ehelp text
const helpTarget =       name: 'Server Management',;
const helpReplace =       name: 'Spam Access Control',\n      value:\n        '> ezal spampermit <userId> — Grant spam access\\n' +\n        '> ezal spamrevoke <userId> — Revoke spam access\\n' +\n        '> ezal spamlist — List permitted spammers'\n    },\n    {\n      name: 'Server Management',;
code = code.replace(helpTarget, helpReplace);

// 3. Append functions to bottom
const functions = 
// ==========================================
// SPAM MANAGEMENT
// ==========================================
async function handleSpamPermit(message, args) {
  const targetId = args[0]?.replace(/\\D/g, '');
  if (!targetId || targetId.length < 17) {
    return message.reply(cv2.warn('Usage Error', '**Usage:** \ezal spampermit <userId>\'));
  }
  const added = db.addSpamPermit(targetId);
  return message.reply(added ? cv2.success('Spam Access Granted', \<@\> can now use the spam command.\) : cv2.warn('Already Permitted', 'User already has spam access.'));
}
async function handleSpamRevoke(message, args) {
  const targetId = args[0]?.replace(/\\D/g, '');
  if (!targetId || targetId.length < 17) return message.reply(cv2.warn('Usage Error', '**Usage:** \ezal spamrevoke <userId>\'));
  const removed = db.removeSpamPermit(targetId);
  return message.reply(removed ? cv2.danger('Spam Access Revoked', \<@\>'s spam access revoked.\) : cv2.warn('Not Found', 'User doesn\\'t have spam access.'));
}
async function handleSpamList(message) {
  const list = db.getSpamPermitted();
  if (list.length === 0) return message.reply(cv2.info('Spam List', 'No users permitted.'));
  const lines = list.map((id, i) => \\. <@\> (\ + id + \)\);
  return message.reply(cv2.security('Spam Access List', lines.join('\\n') + '\\n\\nTotal: **' + list.length + '**'));
}
;
code = code + functions;

fs.writeFileSync('src/commands/ezal.js', code, 'utf8');
console.log('patched ezal.js successfully');

