const { Client, Message } = require('discord.js');
const client = new Client({ intents: [] });
const db = require('./src/database.js').default;

client.login(db.config?.token || process.env.DISCORD_TOKEN).catch(()=>null);
client.on('ready', async () => {
  try {
    const user = await client.users.fetch('1383136323183050974').catch(()=>null);
    const dm = await user.createDM();
    
    const { commands } = require('./src/commands/utility.js');
    const helpCmd = commands.find(c => c.name === 'help');
    
    const fakeMessage = {
      client: client,
      author: user,
      guild: null,
      channel: {
        send: async (options) => {}
      },
      reply: async (options) => {
        try {
          const res = await dm.send(options);
        } catch (e) {
          console.error('FULL STACK TRACE:\n', e.stack);
          process.exit(1);
        }
      }
    };
    
    await helpCmd.executePrefix(fakeMessage, []);
    
  } catch (e) {
    console.error('OUTER ERROR:', e.message);
    process.exit(1);
  }
});
