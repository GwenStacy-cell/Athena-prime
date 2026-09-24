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
      console.log('CAUGHT BY EXECUTEPREFIX:', options.content);
      process.exit(0);
    }
  },
  reply: async (options) => {
    console.log('REPLY WAS CALLED!');
    process.exit(0);
  }
};

helpCmd.executePrefix(fakeMessage, []).catch(e => {
  console.log('UNHANDLED:', e);
});
