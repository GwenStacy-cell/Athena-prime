import fs from "fs";
let js = fs.readFileSync("src/commands/welcome.js", "utf8");
js = js.replace(/if \(action === 'toggle_avatar'\) \{[\s\S]*?return interaction\.update\(getManagerPanel\(guildId, typeStr\)\);\s*\}/, 
`if (action === 'cycle_avatar') {
    const sequence = ['thumbnail', 'author', 'footer', 'image', 'off'];
    const current = cfg.avatarPos || 'thumbnail';
    const next = sequence[(sequence.indexOf(current) + 1) % sequence.length];
    setConfig(guildId, { ...cfg, avatarPos: next });
    return interaction.update(getManagerPanel(guildId, typeStr));
  }
  
  if (action === 'cycle_name') {
    const sequence = ['tag', 'user_link', 'nick_link'];
    const current = cfg.nameFormat || 'tag';
    const next = sequence[(sequence.indexOf(current) + 1) % sequence.length];
    setConfig(guildId, { ...cfg, nameFormat: next });
    return interaction.update(getManagerPanel(guildId, typeStr));
  }`);
fs.writeFileSync("src/commands/welcome.js", js);
