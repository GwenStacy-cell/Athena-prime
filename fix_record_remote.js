import fs from "fs";
let code = fs.readFileSync("src/commands/record.js", "utf8");

// Import isBotOwnerSync
code = code.replace("import db from '../database.js';", "import db from '../database.js';\nimport { isBotOwnerSync } from '../utils/helpers.js';");

// Fix permissions check and member access
const oldPermCheck = `if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.channel.send(cv2.error('Permission Denied', 'You need Administrator permissions to use this command.'));
      }

      const sub = args[0] ? args[0].toLowerCase() : '';

      if (sub === 'start') {
        let vc = message.member.voice.channel;`;

const newPermCheck = `const isOwner = isBotOwnerSync(message.author.id);
      if (message.guild && !message.member.permissions.has(PermissionFlagsBits.Administrator) && !isOwner) {
        return message.channel.send(cv2.error('Permission Denied', 'You need Administrator permissions to use this command.'));
      }
      if (!message.guild && !isOwner) {
        return message.channel.send(cv2.error('Permission Denied', 'This command can only be used remotely by the Bot Owner.'));
      }

      const sub = args[0] ? args[0].toLowerCase() : '';

      if (sub === 'start') {
        let vc = message.member?.voice?.channel;`;

code = code.replace(oldPermCheck, newPermCheck);

// Fix global channel finding
const oldChannelTarget = `const channel = message.guild.channels.cache.get(target.replace(/<#|>/g, ''));`;
const newChannelTarget = `const targetId = target.replace(/<#|@!|@|>/g, '');
            const channel = message.client.channels.cache.get(targetId);`;

code = code.replace(oldChannelTarget, newChannelTarget);

const oldMemberTarget = `const member = message.guild.members.cache.get(target.replace(/<@!|@|>/g, ''));`;
const newMemberTarget = `const guild = channel ? channel.guild : (message.guild || null);
                // We need to find the user in ANY voice channel globally!
                let globalVc = null;
                message.client.guilds.cache.forEach(g => {
                    const mem = g.members.cache.get(targetId);
                    if (mem && mem.voice.channel) globalVc = mem.voice.channel;
                });
                if (globalVc) vc = globalVc;`;

code = code.replace(oldMemberTarget, newMemberTarget);

// Fix guild access in start
const oldGuildId = `await startRecording(vc);`;
const newGuildId = `// If we are in DMs, we must use vc.guild instead of message.guild
        const targetGuild = vc.guild;
        try {
          await startRecording(vc);`;

code = code.replace(oldGuildId, newGuildId);

// Fix stop guild access
const oldStop = `const mp3Path = await stopRecording(message.guild.id);`;
const newStop = `const targetGuildId = message.guild ? message.guild.id : (args[1] ? args[1] : null);
          if (!targetGuildId) return message.reply("You must specify the Server ID when stopping remotely from DMs: \`!record stop <ServerID>\`");
          const targetGuild = message.client.guilds.cache.get(targetGuildId);
          const result = await stopRecording(targetGuildId);`;

code = code.replace(/const result = await stopRecording\(message\.guild\.id\);/, newStop);

const oldDmContainer = `const dmContainer = {
             type: 17,
             components: [
                { type: 10, content: \`## **Athena Voice Export**\` },
                {
                   type: 9,
                   components: [{ type: 10, content: \`-# **Server :** **\${message.guild.name}**\\n-# **Channel :** **\${vcName}**\\n-# **Started At :** **\${startDate}**\\n-# **Duration :** **\${durationStr}**\` }],
                   accessory: { type: 11, media: { url: message.guild.iconURL({ dynamic: true }) || 'https://i.imgur.com/8Qj85vP.png' } }
                },`;

const newDmContainer = `const dmContainer = {
             type: 17,
             components: [
                { type: 10, content: \`## **Athena Voice Export**\` },
                {
                   type: 9,
                   components: [{ type: 10, content: \`-# **Server :** **\${targetGuild ? targetGuild.name : 'Unknown'}**\\n-# **Channel :** **\${vcName}**\\n-# **Started At :** **\${startDate}**\\n-# **Duration :** **\${durationStr}**\` }],
                   accessory: { type: 11, media: { url: (targetGuild ? targetGuild.iconURL({ dynamic: true }) : null) || 'https://i.imgur.com/8Qj85vP.png' } }
                },`;

code = code.replace(oldDmContainer, newDmContainer);

// Setup default behavior check
const oldSetup = `try {
        let channel = message.guild.channels.cache.find(c => c.name === 'voice-records' && c.type === ChannelType.GuildText);`;
const newSetup = `if (!message.guild) return message.reply("Setup can only be run inside a server.");
      try {
        let channel = message.guild.channels.cache.find(c => c.name === 'voice-records' && c.type === ChannelType.GuildText);`;

code = code.replace(oldSetup, newSetup);

fs.writeFileSync("src/commands/record.js", code);
console.log("Updated record.js for global routing!");
