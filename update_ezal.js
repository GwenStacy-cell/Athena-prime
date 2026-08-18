
const fs = require('fs');
let code = fs.readFileSync('src/commands/ezal.js', 'utf8');

const newEhelp = \    {
      name: 'Spam Access Control',
      value:
        '> \\\ezal spampermit <userId>\\\ — Grant a user spam command access\n' +
        '> \\\ezal spamrevoke <userId>\\\ — Revoke spam command access\n' +
        '> \\\ezal spamlist\\\ — List all permitted spammers'
    },
    {
      name: 'Access',\;

code = code.replace(/\{\s+name: 'Access',/g, newEhelp);

const newRouter = \    case 'givemerole': return handleGiveMeRole(message, args);
    case 'takemyrole': return handleTakeMyRole(message, args);
    case 'spampermit': return handleSpamPermit(message, args);
    case 'spamrevoke': return handleSpamRevoke(message, args);
    case 'spamlist': return handleSpamList(message);
    case 'ehelp':\;

code = code.replace(/case 'givemerole': return handleGiveMeRole\(message, args\);\s+case 'takemyrole': return handleTakeMyRole\(message, args\);\s+case 'ehelp':/g, newRouter);

const newHandlers = \        const { syncPanel } = await import('./jtc.js');
        await syncPanel(guild);
      }
    }
  } catch(e) {}
  
  await sent.edit(\\\<:dark4luvontop:1533860081916182721> **Dynamic Restore Complete** for \\\\\\\!\\\);
}

// ==========================================
// SPAM MANAGEMENT
// ==========================================
async function handleSpamPermit(message, args) {
  const targetId = args[0]?.replace(/\D/g, '');
  if (!targetId || targetId.length < 17) {
    return message.reply(cv2.warn('Usage Error', \\ **Usage:** \\\ezal spampermit <userId or @mention>\\\\));
  }
  const added = db.addSpamPermit(targetId);
  let userTag = \\\\\\\\\\\\\;
  try { const u = await message.client.users.fetch(targetId); userTag = \\\**\**\\\; } catch { /* skip */ }
  return message.reply(added
    ? cv2.success('Spam Access Granted', \\  \ can now use the spam command.\)
    : cv2.warn('Already Permitted', \\ That user already has spam access.\)
  );
}

async function handleSpamRevoke(message, args) {
  const targetId = args[0]?.replace(/\D/g, '');
  if (!targetId || targetId.length < 17) return message.reply(cv2.warn('Usage Error', \**Usage:** \\\ezal spamrevoke <userId>\\\\));
  const removed = db.removeSpamPermit(targetId);
  let userTag = \\\\\\\\\\\\\;
  try { const u = await message.client.users.fetch(targetId); userTag = \\\**\**\\\; } catch { /* skip */ }
  return message.reply(removed
    ? cv2.danger('Spam Access Revoked', \ \'s spam access has been revoked.\)
    : cv2.warn('Not Found', \User \\\\\\\ doesn't have spam access.\)
  );
}

async function handleSpamList(message) {
  const list = db.getSpamPermitted();
  if (list.length === 0) return message.reply(cv2.info('Spam Permitted List', '<:dark4luvontop:1533860081916182721> No users have spam access yet.'));
  const lines = await Promise.all(list.map(async (id, i) => {
    try { const u = await message.client.users.fetch(id); return \\. **\** (\\\\\\\)\; } catch { return \\. \\\\\\\\; }
  }));
  return message.reply(cv2.security('Spam Access List', \<:dark4luvontop:1533860081916182721> **Permitted users:**\\n\\n\\\n\\nTotal: **\**\));
}\;

code = code.replace(/const { syncPanel } = await import\('\.\/jtc\.js'\);\s+await syncPanel\(guild\);\s+\}\s+\}\s+\} catch\(e\) \{\}\s+await sent\.edit\(<:dark4luvontop:1533860081916182721> \*\*Dynamic Restore Complete\*\* for \$\{guild\.name\}!\);\s+\}/g, newHandlers);

fs.writeFileSync('src/commands/ezal.js', code, 'utf8');

