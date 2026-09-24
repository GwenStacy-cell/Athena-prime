const fs = require('fs');
let code = fs.readFileSync('src/utils/antinuke.js', 'utf8');

const ownerOld = `
            await owner.send(cv2.danger(
              'CRITICAL: Athena Firewall Engaged',
              \`A hostile action was detected, neutralized, and reversed on **${guild.name}** in milliseconds.\`
`;

const ownerNew = `
            await owner.send(cv2.danger(
              (punishResult.startsWith('Total failure') || punishResult.startsWith('Hierarchy blocked')) ? 'CRITICAL: Athena Firewall Bypassed' : 'CRITICAL: Athena Firewall Engaged',
              (punishResult.startsWith('Total failure') || punishResult.startsWith('Hierarchy blocked'))
                ? \`<:émoji×_16:1521464002046328944> **URGENT:** A hostile action was detected on **${guild.name}**, but **COULD NOT BE NEUTRALIZED** because the attacker's role is higher than mine in the Discord Server Settings!\n\n**Please intervene immediately and move my role higher!**`
                : \`A hostile action was detected, neutralized, and reversed on **${guild.name}** in milliseconds.\`
`�;

code = code.replace(ownerOld.trim(), ownerNew.trim());

const attackerOld = `
        // DM fire-and-forget
        guild.members.fetch(executor.id).then(m => {
          m?.send(cv2.danger('Eliminated — Athena Prime Firewall',
            \`You have been permanently banned from **${guild.name}**.\n\n**Violation:** ${eventType}\n\n*Athena Prime detected and neutralized your attack in milliseconds.*`
          )).then()=>null).catch(() => null);
        }).catch(() => null);
`

const attackerNew = `
        // DM fire-and-forget (ONLY if actually punishED)
        if (!result.startsWith('Total failure') && !result.startsWith('Hierarchy blocked')) {
          guild.members.fetch(executor.id).then(m => {
            m?.send(cv2.danger('Eliminated — Athena Prime Firewall',
              \`You have been permanently banned from **${guild.name}**.\n\n**Violation:** ${eventType}\n\n*Athena Prime detected and neutralized your attack in milliseconds.*`
            )).then()=>null).catch(() => null);
          }).catch(() => null);
        }
`

code = code.replace(attackerOld.trim(), attackerNew.trim());

fs.writeFileSync('src/utils/antinuke.js', code);
console.log('Patched successfully.');