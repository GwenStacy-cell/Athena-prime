const fs = require('fs');
let code = fs.readFileSync('src/utils/antinuke.js', 'utf8');

// 1. Fix the attacker DM logic in punish()
const punishDMOld =         // DM fire-and-forget
        guild.members.fetch(executor.id).then(m => {
          m?.send(cv2.danger('Eliminated — Athena Prime Firewall',
            \You have been permanently banned from **\**.\\n\\n**Violation:** \\\n\\n*Athena Prime detected and neutralized your attack in milliseconds.*\
          )).catch(() => null);
        }).catch(() => null);;

const punishDMNew =         // DM fire-and-forget (ONLY if actually punished)
        if (!result.startsWith('Total failure') && !result.startsWith('Hierarchy blocked')) {
          guild.members.fetch(executor.id).then(m => {
            m?.send(cv2.danger('Eliminated — Athena Prime Firewall',
              \You have been permanently banned from **\**.\\n\\n**Violation:** \\\n\\n*Athena Prime detected and neutralized your attack in milliseconds.*\
            )).catch(() => null);
          }).catch(() => null);
        };

// 2. Fix the server owner DM logic in notifyAndLog()
const notifyLogOld =           if (owner) {
            await owner.send(cv2.danger(
              'CRITICAL: Athena Firewall Engaged',
              \A hostile action was detected, neutralized, and reversed on **\** in milliseconds.\,
              [
                { name: 'Eliminated',  value: \**\** (\\\\\\\)\ },
                { name: 'Attack Type', value: \\\\\\\\\ },
                { name: 'Verdict',     value: \**\**\ },
                { name: 'Rollback',    value: \\\ }
              ]
            )).catch(() => null);
          };

const notifyLogNew =           if (owner) {
            const isFailure = punishResult.startsWith('Total failure') || punishResult.startsWith('Hierarchy blocked');
            const desc = isFailure 
              ? \?? **URGENT:** A hostile action was detected on **\**, but **COULD NOT BE NEUTRALIZED** because the attacker's role is higher than mine in the Discord Server Settings!\\n\\n**Please intervene immediately and move my role higher!**\
              : \A hostile action was detected, neutralized, and reversed on **\** in milliseconds.\;
            
            await owner.send(cv2.danger(
              isFailure ? 'CRITICAL: Athena Firewall Bypassed' : 'CRITICAL: Athena Firewall Engaged',
              desc,
              [
                { name: 'Attacker',    value: \**\** (\\\\\\\)\ },
                { name: 'Attack Type', value: \\\\\\\\\ },
                { name: 'Verdict',     value: \**\**\ },
                { name: 'Rollback',    value: \\\ }
              ]
            )).catch(() => null);
          };

code = code.replace(punishDMOld, punishDMNew);
code = code.replace(notifyLogOld, notifyLogNew);

fs.writeFileSync('src/utils/antinuke.js', code);
console.log('Done!');
