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
        send: async (options) => {
           console.log('CHANNEL SEND CALLED WITH:', options);
           process.exit(0);
        }
      },
      reply: async (options) => {
        try {
          const res = await dm.send(options);
          console.log('SUCCESS REPLY SENT!');
          process.exit(0);
        } catch (e) {
          console.error('SEND ERROR:', e.message);
          throw e;
        }
      }
    };
    
    await helpCmd.executePrefix(fakeMessage, []);
    
  } catch (e) {
    console.error('OUTER ERROR:', e.message);
    process.exit(1);
  }
});
