const fs = require('fs');
let code = fs.readFileSync('src/events/messageCreate.js', 'utf8');

code = code.replace(
  /if \(message\.guild\)\s*\{\s*setTimeout\(\(\) => \{\s*const stickyData = db\.getStickyMessage\(message\.guild\.id, message\.channel\.id\);/g,
  'if (message.guild) {\n      const guildId = message.guild.id;\n      const channelId = message.channel.id;\n      setTimeout(() => {\n        const stickyData = db.getStickyMessage(guildId, channelId);'
);

fs.writeFileSync('src/events/messageCreate.js', code);
