const { Client } = require('discord.js');
const client = new Client({ intents: [] });
const db = require('./src/database.js').default;

client.login(db.config?.token || process.env.DISCORD_TOKEN).catch(()=>null);
client.on('ready', async () => {
  try {
    const user = await client.users.fetch('1383136323183050974').catch(()=>null);
    const dm = await user.createDM();
    console.log('Got DM channel:', dm.id);
    
    function buildHelpContainer() {
      const rawComponents = [];
      rawComponents.push({ type: 10, content: 'test' });
      
      const HELP_GIF = 'https://cdn.discordapp.com/attachments/1534869224277807175/1542472732325978234/ATHENA-8-27-2026.png?ex=6a915b2d&is=6a9009ad&hm=0f55bae0c0bec27649bc03e6d6be23ad16f2eb9337efdb8b5793b2d74cad89ff&';
      rawComponents.push({ type: 12, items: [{ media: { url: HELP_GIF } }] });
      
      return { type: 17, components: rawComponents };
    }
    
    const comps = buildHelpContainer();
    
    const res = await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${client.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        components: [comps],
        flags: 32768
      })
    });
    const json = await res.json();
    console.log('Response:', JSON.stringify(json, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
