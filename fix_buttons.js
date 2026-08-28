import fs from 'fs';
let code = fs.readFileSync('src/events/interactionCreate.js', 'utf8');

const regexSecBack = /if \(customId === 'sec_back'\) \{[\s\S]*?catch\(e\) \{ console\.error\(e\); \}\n    \}/;
const newSecBack = `if (customId === 'sec_back') {
      try {
        const sec = await import('../commands/security.js');
        const panel = await sec.getSecurityStatusPanel(guild);
        return interaction.update(panel);
      } catch(e) { console.error(e); }
    }

    if (customId === 'sec_module_manage') {
      try {
        const sec = await import('../commands/security.js');
        const panel = await sec.getAntinukeConfigPanel(guild);
        return interaction.update(panel);
      } catch(e) { console.error(e); }
    }

    if (customId === 'sec_close') {
      try {
        return interaction.message.delete();
      } catch(e) { console.error(e); }
    }`;

code = code.replace(regexSecBack, newSecBack);

fs.writeFileSync('src/events/interactionCreate.js', code);
console.log("Fixed missing buttons!");
