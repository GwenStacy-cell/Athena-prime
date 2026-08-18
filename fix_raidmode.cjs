
const fs = require('fs');
let code = fs.readFileSync('src/commands/security.js', 'utf8');

const t1 =       const unquarantineResult = await handleMassUnquarantine(guild, moderator, guild.client, 'raidmode');
      
      let releaseNote = '';
      if (unquarantineResult.embed.data.title !== 'Nothing to Release') {
         releaseNote = \\\n\\n**Auto-Release Triggered:**\\n\\;
      } else {
         releaseNote = \\\n\\n*(No quarantined accounts to release)*\;
      };

const r1 =       const unquarantineResult = await handleMassUnquarantine(guild, moderator, guild.client, 'raidmode');
      
      let releaseNote = '';
      if (unquarantineResult.success > 0 || unquarantineResult.failed > 0) {
         releaseNote = \\\n\\n**Auto-Release Triggered:**\\nSuccessfully released \\\\\\\ members (\\\\\\\ failed).\;
      } else {
         releaseNote = \\\n\\n*(No quarantined accounts to release)*\;
      };

const t2 = sync function handleMassUnquarantine(guild, moderator, client, context = null) {
  const quarantined = db.getQuarantinedInGuild(guild.id);

  if (!quarantined || quarantined.length === 0) {
    return cv2.info('Nothing to Release', 'There are no quarantined members in this server.');
  };

const r2 = sync function handleMassUnquarantine(guild, moderator, client, context = null) {
  const quarantined = db.getQuarantinedInGuild(guild.id);

  if (!quarantined || quarantined.length === 0) {
    if (context === 'raidmode') return { success: 0, failed: 0 };
    return cv2.info('Nothing to Release', 'There are no quarantined members in this server.');
  };

const t3 =   logToSecurityChannel(guild, cv2.log(
    'Mass Unquarantine Executed',
    \**\** released all quarantined members.\,
    [
      { name: ' Released', value: \\\\\\\\\, inline: true },
      { name: ' Failed',   value: \\\\\\\\\,  inline: true }
    ],
    'success'
  ));

  return cv2.success(;

const r3 =   logToSecurityChannel(guild, cv2.log(
    'Mass Unquarantine Executed',
    \**\** released all quarantined members.\,
    [
      { name: ' Released', value: \\\\\\\\\, inline: true },
      { name: ' Failed',   value: \\\\\\\\\,  inline: true }
    ],
    'success'
  ));

  if (context === 'raidmode') return { success, failed };

  return cv2.success(;

code = code.replace(t1, r1);
code = code.replace(t2, r2);
code = code.replace(t3, r3);

fs.writeFileSync('src/commands/security.js', code, 'utf8');
console.log('Fixed successfully');

