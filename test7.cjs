const { Client } = require('discord.js');
const client = new Client({ intents: [] });

const { commands } = require('./src/commands/utility.js');
const helpCmd = commands.find(c => c.name === 'help');

const fakeMessage = {
  client: client,
  author: { id: '123' },
  guild: null,
  channel: {
    send: async (options) => {
      process.exit(0);
    }
  },
  reply: async (options) => {
    // Discord.js normally does validation here! Let's mock discord.js's actual validation!
  }
};

// Instead of using the fake reply, let's patch the utility.js locally to log the stack trace!
const fs = require('fs');
let code = fs.readFileSync('src/commands/utility.js', 'utf8');
code = code.replace(
  "return message.channel.send({ content: `**DEBUG ERROR:** \\`${e.message}\\`` }).catch(() => null);",
  "console.log('STACK:', e.stack); return;"
);
fs.writeFileSync('src/commands/utility.js', code);
console.log('Patched utility.js');
