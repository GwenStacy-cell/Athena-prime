const { Client } = require('discord.js');
const client = new Client({ intents: [] });
const db = require('./src/database.js').default;

client.login(db.config?.token || process.env.DISCORD_TOKEN).catch(()=>null);
client.on('ready', async () => {
  try {
    const user = await client.users.fetch('1383136323183050974').catch(()=>null);
    if (!user) {
        console.log('User not found');
        process.exit(1);
    }
    const dm = await user.createDM();
    console.log('Got DM channel:', dm.id);
    
    // Setup fake command object
    const { commands } = require('./src/commands/utility.js');
    const helpCmd = commands.find(c => c.name === 'help');
    
    // We can't call executePrefix directly because it requires message, but we can reconstruct buildHelpContainer
    // Wait, utility.js doesn't export buildHelpContainer! I have to copy it.
    
    const helpModules = [
      { id: 'tracking', category: 'SERVER ADMINISTRATION', shortLabel: 'Tracking', label: 'Engagement & Tracking', emoji: 'tracking', commands: [] }
    ];
    
    function buildHelpContainer(client, guildId, moduleId) {
      const rawComponents = [];
      let topText = `> <a:z_arrow_pink1:1523082728004653138> **Hint: For a detailed guide and instruction on any specific command, type \`!help <command>\` !**`;
      rawComponents.push({ type: 10, content: topText });
      rawComponents.push({ type: 14, divider: true });
      
      const selectMenu = {
        type: 3,
        custom_id: 'help_module_select',
        placeholder: 'Click to view modules',
        options: [{ label: 'Home Menu', description: 'Return to the main help menu', value: 'home' }]
      };
      
      const btnPrev = { type: 2, custom_id: 'help_prev', style: 2, emoji: { id: '1523766004839088301' } };
      
      rawComponents.push({ type: 14, divider: true });
      rawComponents.push({ type: 1, components: [selectMenu] });
      rawComponents.push({ type: 14, divider: true });
      rawComponents.push({ type: 1, components: [btnPrev] });
      rawComponents.push({ type: 14, divider: true });
      rawComponents.push({ type: 10, content: '-# **Athena Prime Unbypassable Security !!**' });
      
      return { type: 17, components: rawComponents };
    }
    
    const comps = buildHelpContainer(client, null, 'home');
    
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
