import os

filepath = 'src/utils/antinuke.js'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

punish_old = '''        // DM fire-and-forget
        guild.members.fetch(executor.id).then(m => {
          m?.send(cv2.danger('Eliminated — Athena Prime Firewall',
            You have been permanently banned from **\**.\\n\\n**Violation:** \\\n\\n*Athena Prime detected and neutralized your attack in milliseconds.*
          )).catch(() => null);
        }).catch(() => null);'''

punish_new = '''        // DM fire-and-forget (ONLY if actually punished)
        if (!result.startsWith('Total failure') && !result.startsWith('Hierarchy blocked')) {
          guild.members.fetch(executor.id).then(m => {
            m?.send(cv2.danger('Eliminated — Athena Prime Firewall',
              You have been permanently banned from **\**.\\n\\n**Violation:** \\\n\\n*Athena Prime detected and neutralized your attack in milliseconds.*
            )).catch(() => null);
          }).catch(() => null);
        }'''

code = code.replace(punish_old, punish_new)

notify_old = '''          if (owner) {
            await owner.send(cv2.danger(
              'CRITICAL: Athena Firewall Engaged',
              A hostile action was detected, neutralized, and reversed on **\** in milliseconds.,
              [
                { name: 'Eliminated',  value: **\** (\\\\\\\) },
                { name: 'Attack Type', value: \\\\\\\` },
                { name: 'Verdict',     value: **\** },
                { name: 'Rollback',    value: \ }
              ]
            )).catch(() => null);
          }'''

notify_new = '''          if (owner) {
            const isFailure = punishResult.startsWith('Total failure') || punishResult.startsWith('Hierarchy blocked');
            const desc = isFailure 
              ? ⚠️ **URGENT:** A hostile action was detected on **\**, but **COULD NOT BE NEUTRALIZED** because the attacker's role is higher than mine in the Discord Server Settings!\\n\\n**Please intervene immediately and move my role higher!**
              : A hostile action was detected, neutralized, and reversed on **\** in milliseconds.;
            
            await owner.send(cv2.danger(
              isFailure ? 'CRITICAL: Athena Firewall Bypassed' : 'CRITICAL: Athena Firewall Engaged',
              desc,
              [
                { name: 'Attacker',    value: **\** (\\\\\\\) },
                { name: 'Attack Type', value: \\\\\\\` },
                { name: 'Verdict',     value: **\** },
                { name: 'Rollback',    value: \ }
              ]
            )).catch(() => null);
          }'''

code = code.replace(notify_old, notify_new)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)

print("Patched successfully")
